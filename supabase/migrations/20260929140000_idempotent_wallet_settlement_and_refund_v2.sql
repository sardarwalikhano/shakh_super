-- SHAKH Stage 6: idempotent wallet earning/refund protection.

CREATE OR REPLACE FUNCTION public.settle_delivered_order_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_vendor_id uuid;
  v_inserted integer := 0;
  v_tx_inserted integer := 0;
BEGIN
  IF NEW.status IS DISTINCT FROM 'delivered'::public.order_status OR OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT s.owner_id INTO v_vendor_id
  FROM public.stores s WHERE s.id = NEW.store_id;

  INSERT INTO public.order_financials (
    order_id, customer_id, vendor_id, captain_id, store_id,
    subtotal_iqd, delivery_fee_iqd, platform_fee_iqd, discount_iqd,
    customer_total_iqd, vendor_earnings_iqd, captain_earnings_iqd, platform_earnings_iqd
  ) VALUES (
    NEW.id, NEW.customer_id, v_vendor_id, NEW.captain_id, NEW.store_id,
    NEW.subtotal_iqd, NEW.delivery_fee_iqd, NEW.platform_fee_iqd, NEW.discount_iqd,
    NEW.total_iqd, NEW.subtotal_iqd, NEW.delivery_fee_iqd, NEW.platform_fee_iqd
  )
  ON CONFLICT (order_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 1 THEN
    IF v_vendor_id IS NOT NULL AND NEW.subtotal_iqd > 0 THEN
      INSERT INTO public.wallets(user_id) VALUES (v_vendor_id)
      ON CONFLICT (user_id) DO NOTHING;

      INSERT INTO public.wallet_transactions(wallet_id,type,amount_iqd,reference_id,description)
      SELECT w.id,'earning'::public.wallet_tx_type,NEW.subtotal_iqd,NEW.id,
             'داهاتی فرۆشی ئۆردەر #' || left(NEW.id::text,8)
      FROM public.wallets w WHERE w.user_id=v_vendor_id
      ON CONFLICT (wallet_id,type,reference_id) DO NOTHING;

      GET DIAGNOSTICS v_tx_inserted = ROW_COUNT;
      IF v_tx_inserted = 1 THEN
        UPDATE public.wallets SET balance_iqd=balance_iqd+NEW.subtotal_iqd,updated_at=now()
        WHERE user_id=v_vendor_id;
      END IF;
    END IF;

    IF NEW.captain_id IS NOT NULL AND NEW.delivery_fee_iqd > 0 THEN
      INSERT INTO public.wallets(user_id) VALUES (NEW.captain_id)
      ON CONFLICT (user_id) DO NOTHING;

      INSERT INTO public.wallet_transactions(wallet_id,type,amount_iqd,reference_id,description)
      SELECT w.id,'earning'::public.wallet_tx_type,NEW.delivery_fee_iqd,NEW.id,
             'داهاتی گەیاندنی ئۆردەر #' || left(NEW.id::text,8)
      FROM public.wallets w WHERE w.user_id=NEW.captain_id
      ON CONFLICT (wallet_id,type,reference_id) DO NOTHING;

      GET DIAGNOSTICS v_tx_inserted = ROW_COUNT;
      IF v_tx_inserted = 1 THEN
        UPDATE public.wallets SET balance_iqd=balance_iqd+NEW.delivery_fee_iqd,updated_at=now()
        WHERE user_id=NEW.captain_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id uuid,p_next_status public.order_status
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $$
DECLARE
  v_order public.orders;
  v_role public.app_role;
  v_current public.order_status;
  v_allowed boolean:=false;
  v_refund_inserted integer:=0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;

  SELECT role INTO v_role FROM public.user_roles
  WHERE user_id=auth.uid() AND is_active=true
  ORDER BY created_at DESC LIMIT 1;

  IF v_role IS NULL THEN
    SELECT role::public.app_role INTO v_role FROM public.profiles WHERE id=auth.uid();
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  v_current:=v_order.status;

  IF v_role IN ('super_admin','admin') THEN
    v_allowed:=true;
  ELSIF v_role='customer' THEN
    v_allowed:=v_order.customer_id=auth.uid() AND v_current='pending' AND p_next_status='cancelled';
  ELSIF v_role IN ('restaurant_vendor','supermarket_vendor','fashion_vendor','vendor','electronics_vendor','jewelry_vendor') THEN
    v_allowed:=EXISTS(SELECT 1 FROM public.stores s WHERE s.id=v_order.store_id AND s.owner_id=auth.uid())
      AND ((v_current='pending' AND p_next_status='accepted')
        OR (v_current='accepted' AND p_next_status='preparing')
        OR (v_current='preparing' AND p_next_status='ready_for_pickup'));
  ELSIF v_role='captain' THEN
    v_allowed:=v_order.captain_id=auth.uid()
      AND ((v_current='assigned_to_captain' AND p_next_status='picked_up')
        OR (v_current='picked_up' AND p_next_status='on_the_way')
        OR (v_current='on_the_way' AND p_next_status='delivered'));
  END IF;

  IF NOT v_allowed THEN RAISE EXCEPTION 'status_transition_not_allowed'; END IF;

  IF v_current='pending' AND p_next_status='cancelled' THEN
    UPDATE public.products p
    SET stock=coalesce(p.stock,0)+oi.quantity,
        is_available=CASE WHEN coalesce(p.stock,0)+oi.quantity>0 THEN true ELSE p.is_available END,
        updated_at=now()
    FROM public.order_items oi
    WHERE oi.order_id=v_order.id AND oi.product_id=p.id;

    IF v_order.payment_method='wallet'
       AND v_order.payment_status='paid'::public.payment_status THEN
      INSERT INTO public.wallets(user_id)
      VALUES(v_order.customer_id)
      ON CONFLICT(user_id) DO NOTHING;

      INSERT INTO public.wallet_transactions(wallet_id,type,amount_iqd,reference_id,description)
      SELECT w.id,'refund'::public.wallet_tx_type,v_order.total_iqd,v_order.id,
             'گەڕانەوەی پارەی Wallet بۆ ئۆردەر #' || left(v_order.id::text,8)
      FROM public.wallets w WHERE w.user_id=v_order.customer_id
      ON CONFLICT(wallet_id,type,reference_id) DO NOTHING;

      GET DIAGNOSTICS v_refund_inserted = ROW_COUNT;
      IF v_refund_inserted = 1 THEN
        UPDATE public.wallets
        SET balance_iqd=balance_iqd+v_order.total_iqd,updated_at=now()
        WHERE user_id=v_order.customer_id;
      END IF;

      v_order.payment_status:='refunded'::public.payment_status;
    END IF;
  END IF;

  UPDATE public.orders
  SET status=p_next_status,payment_status=v_order.payment_status,updated_at=now(),
      delivered_at=CASE
        WHEN p_next_status='delivered' AND v_order.delivered_at IS NULL THEN now()
        WHEN v_order.delivered_at IS NOT NULL THEN v_order.delivered_at
        ELSE NULL END
  WHERE id=p_order_id
  RETURNING * INTO v_order;

  IF p_next_status IN ('delivered','cancelled') THEN
    DELETE FROM public.delivery_tracking_locations WHERE order_id=p_order_id;
  END IF;

  RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_delivered_order_financials() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.transition_order_status(uuid,public.order_status) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transition_order_status(uuid,public.order_status) TO authenticated;
