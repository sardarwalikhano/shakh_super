-- SHAKH Stage 6: financial integrity, wallet settlement and commission ledger.

ALTER TABLE public.orders
  ADD CONSTRAINT orders_subtotal_nonnegative_chk CHECK (subtotal_iqd >= 0),
  ADD CONSTRAINT orders_delivery_fee_nonnegative_chk CHECK (delivery_fee_iqd >= 0),
  ADD CONSTRAINT orders_platform_fee_nonnegative_chk CHECK (platform_fee_iqd >= 0),
  ADD CONSTRAINT orders_discount_nonnegative_chk CHECK (discount_iqd >= 0),
  ADD CONSTRAINT orders_discount_not_above_subtotal_chk CHECK (discount_iqd <= subtotal_iqd),
  ADD CONSTRAINT orders_total_integrity_chk CHECK (
    total_iqd = subtotal_iqd + delivery_fee_iqd + platform_fee_iqd - discount_iqd
  );

ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_commission_percent_chk CHECK (commission_percent >= 0 AND commission_percent <= 100),
  ADD CONSTRAINT platform_settings_delivery_fee_nonnegative_chk CHECK (default_delivery_fee_iqd >= 0),
  ADD CONSTRAINT platform_settings_platform_fee_nonnegative_chk CHECK (platform_fee_iqd >= 0);

CREATE TABLE IF NOT EXISTS public.order_financials (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  vendor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  captain_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  subtotal_iqd numeric(14,2) NOT NULL,
  delivery_fee_iqd numeric(14,2) NOT NULL,
  platform_fee_iqd numeric(14,2) NOT NULL,
  discount_iqd numeric(14,2) NOT NULL,
  customer_total_iqd numeric(14,2) NOT NULL,
  vendor_earnings_iqd numeric(14,2) NOT NULL,
  captain_earnings_iqd numeric(14,2) NOT NULL,
  platform_earnings_iqd numeric(14,2) NOT NULL,
  settled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_financials_nonnegative_chk CHECK (
    subtotal_iqd >= 0 AND delivery_fee_iqd >= 0 AND platform_fee_iqd >= 0 AND
    discount_iqd >= 0 AND customer_total_iqd >= 0 AND
    vendor_earnings_iqd >= 0 AND captain_earnings_iqd >= 0 AND platform_earnings_iqd >= 0
  ),
  CONSTRAINT order_financials_total_integrity_chk CHECK (
    customer_total_iqd = subtotal_iqd + delivery_fee_iqd + platform_fee_iqd - discount_iqd
  ),
  CONSTRAINT order_financials_earnings_integrity_chk CHECK (
    vendor_earnings_iqd = subtotal_iqd
    AND captain_earnings_iqd = delivery_fee_iqd
    AND platform_earnings_iqd = platform_fee_iqd
  )
);

ALTER TABLE public.order_financials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.order_financials FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.order_financials FROM authenticated;
GRANT SELECT ON TABLE public.order_financials TO authenticated;

DROP POLICY IF EXISTS order_financials_select_relevant ON public.order_financials;
CREATE POLICY order_financials_select_relevant
ON public.order_financials
FOR SELECT TO authenticated
USING (
  customer_id = (SELECT auth.uid())
  OR captain_id = (SELECT auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = order_financials.store_id AND s.owner_id = (SELECT auth.uid())
  )
  OR (SELECT public.is_admin())
);

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_wallet_type_reference_key
ON public.wallet_transactions(wallet_id, type, reference_id);

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.wallets FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.wallet_transactions FROM anon, authenticated;
GRANT SELECT ON TABLE public.wallets TO authenticated;
GRANT SELECT ON TABLE public.wallet_transactions TO authenticated;

INSERT INTO public.wallets(user_id)
SELECT p.id
FROM public.profiles p
LEFT JOIN public.wallets w ON w.user_id = p.id
WHERE w.id IS NULL
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.settle_delivered_order_financials()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_vendor_id uuid;
  v_inserted integer := 0;
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
    IF v_vendor_id IS NOT NULL THEN
      INSERT INTO public.wallets(user_id) VALUES (v_vendor_id) ON CONFLICT (user_id) DO NOTHING;
      IF NEW.subtotal_iqd > 0 THEN
        INSERT INTO public.wallet_transactions(wallet_id,type,amount_iqd,reference_id,description)
        SELECT w.id,'earning'::public.wallet_tx_type,NEW.subtotal_iqd,NEW.id,
               'داهاتی فرۆشی ئۆردەر #' || left(NEW.id::text,8)
        FROM public.wallets w WHERE w.user_id=v_vendor_id
        ON CONFLICT (wallet_id,type,reference_id) DO NOTHING;
        UPDATE public.wallets SET balance_iqd=balance_iqd+NEW.subtotal_iqd,updated_at=now()
        WHERE user_id=v_vendor_id;
      END IF;
    END IF;

    IF NEW.captain_id IS NOT NULL THEN
      INSERT INTO public.wallets(user_id) VALUES (NEW.captain_id) ON CONFLICT (user_id) DO NOTHING;
      IF NEW.delivery_fee_iqd > 0 THEN
        INSERT INTO public.wallet_transactions(wallet_id,type,amount_iqd,reference_id,description)
        SELECT w.id,'earning'::public.wallet_tx_type,NEW.delivery_fee_iqd,NEW.id,
               'داهاتی گەیاندنی ئۆردەر #' || left(NEW.id::text,8)
        FROM public.wallets w WHERE w.user_id=NEW.captain_id
        ON CONFLICT (wallet_id,type,reference_id) DO NOTHING;
        UPDATE public.wallets SET balance_iqd=balance_iqd+NEW.delivery_fee_iqd,updated_at=now()
        WHERE user_id=NEW.captain_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.settle_delivered_order_financials() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_settle_delivered_order_financials ON public.orders;
CREATE TRIGGER trg_settle_delivered_order_financials
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status='delivered'::public.order_status)
EXECUTE FUNCTION public.settle_delivered_order_financials();
