-- SHAKH Stage 8 self-referral protection:
-- A sharer must not earn a reward from an order placed by the same account.
BEGIN;

CREATE OR REPLACE FUNCTION private.attribute_order_item_to_share()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_code text;
  v_share public.post_share_links%rowtype;
  v_program public.post_referral_programs%rowtype;
  v_post public.posts%rowtype;
  v_order public.orders%rowtype;
  v_earning numeric;
BEGIN
  v_code := nullif(btrim(coalesce(NEW.options->>'__shakh_share_ref', '')), '');

  IF v_code IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = NEW.order_id
  LIMIT 1;

  IF NOT FOUND OR v_order.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT sl.*
  INTO v_share
  FROM public.post_share_links sl
  WHERE lower(btrim(sl.code)) = lower(v_code)
    AND sl.is_active = true
  LIMIT 1;

  IF NOT FOUND OR v_share.sharer_id = v_order.customer_id THEN
    RETURN NEW;
  END IF;

  SELECT rp.*
  INTO v_program
  FROM public.post_referral_programs rp
  WHERE rp.id = v_share.referral_program_id
    AND rp.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT p.*
  INTO v_post
  FROM public.posts p
  WHERE p.id = v_share.post_id
    AND p.status = 'approved'
    AND p.visibility = 'public'
    AND p.archived_at IS NULL
    AND p.listing_details->>'product_id' = NEW.product_id::text
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_earning := round(
    coalesce(NEW.unit_price_iqd, 0)
    * coalesce(NEW.quantity, 0)
    * coalesce(v_program.commission_percent, 0)
    / 100.0,
    2
  );

  INSERT INTO public.order_referral_earnings(
    order_id,
    order_item_id,
    post_id,
    referral_program_id,
    share_link_id,
    beneficiary_user_id,
    commission_percent,
    base_amount_iqd,
    earning_iqd,
    status
  )
  VALUES(
    NEW.order_id,
    NEW.id,
    v_share.post_id,
    v_share.referral_program_id,
    v_share.id,
    v_share.sharer_id,
    coalesce(v_program.commission_percent, 0),
    coalesce(NEW.unit_price_iqd, 0) * coalesce(NEW.quantity, 0),
    v_earning,
    'pending'
  )
  ON CONFLICT (order_item_id) DO UPDATE
  SET share_link_id = EXCLUDED.share_link_id,
      beneficiary_user_id = EXCLUDED.beneficiary_user_id,
      commission_percent = EXCLUDED.commission_percent,
      base_amount_iqd = EXCLUDED.base_amount_iqd,
      earning_iqd = EXCLUDED.earning_iqd,
      status = CASE
        WHEN public.order_referral_earnings.status = 'cancelled'
          THEN public.order_referral_earnings.status
        ELSE EXCLUDED.status
      END;

  UPDATE public.order_items
  SET options = options - '__shakh_share_ref'
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

REVOKE ALL
  ON FUNCTION private.attribute_order_item_to_share()
  FROM PUBLIC, anon, authenticated;

COMMIT;
