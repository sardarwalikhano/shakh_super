-- SHAKH Stage 8 security hardening:
-- Disable the legacy post-owner referral attribution path.
-- Share rewards must be credited only to the actual sharer via post_share_links.

BEGIN;

-- The post-level program code is an internal implementation detail, not a public
-- referral credential. Keep only the fields needed by the feed UI.
REVOKE ALL ON TABLE public.post_referral_programs FROM anon, authenticated;
GRANT SELECT (post_id, commission_percent, is_active, created_at)
  ON public.post_referral_programs TO anon, authenticated;

DROP POLICY IF EXISTS post_referral_programs_public_select ON public.post_referral_programs;
CREATE POLICY post_referral_programs_public_select
ON public.post_referral_programs
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.posts p
    WHERE p.id = post_referral_programs.post_id
      AND p.status = 'approved'
      AND p.visibility = 'public'
      AND p.archived_at IS NULL
  )
  OR post_referral_programs.owner_id = (SELECT auth.uid())
  OR (SELECT public.is_admin())
);

CREATE OR REPLACE FUNCTION private.create_order_with_stock(
  p_store_id uuid,
  p_address_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_coupon_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_order_id uuid;
  v_item record;
  v_product public.products%rowtype;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 1000;
  v_platform_fee numeric := 250;
  v_discount numeric := 0;
  v_total numeric;
  v_wallet_balance numeric;
  v_referral_wallet_balance numeric;
  v_coupon public.coupons%rowtype;
  v_order_item_id uuid;
  v_referral_program_id uuid;
  v_referral_post_id uuid;
  v_referral_owner uuid;
  v_referral_percent numeric(5,2);
  v_referral_base numeric;
  v_referral_earning numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'Store is required';
  END IF;

  IF p_address_id IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM public.delivery_addresses
       WHERE id = p_address_id
         AND user_id = v_user
     ) THEN
    RAISE EXCEPTION 'Invalid delivery address';
  END IF;

  IF p_items IS NULL
     OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  IF lower(coalesce(p_payment_method, 'cash'))
     NOT IN ('cash', 'wallet', 'referral_wallet') THEN
    RAISE EXCEPTION 'Unsupported payment method';
  END IF;

  SELECT
    coalesce(default_delivery_fee_iqd, 1000),
    coalesce(platform_fee_iqd, 250)
  INTO v_delivery_fee, v_platform_fee
  FROM public.platform_settings
  WHERE id = true;

  FOR v_item IN
    SELECT
      product_id,
      coalesce(options, '{}'::jsonb) AS options,
      referral_code,
      sum(quantity)::integer AS quantity
    FROM jsonb_to_recordset(p_items)
      AS x(product_id uuid, quantity integer, options jsonb, referral_code text)
    GROUP BY product_id, coalesce(options, '{}'::jsonb), referral_code
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid cart item';
    END IF;

    SELECT *
    INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found';
    END IF;

    IF v_product.store_id <> p_store_id THEN
      RAISE EXCEPTION 'All products must belong to the same store';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) v
      WHERE jsonb_typeof(v->'shoe_sizes') = 'array'
        AND jsonb_array_length(v->'shoe_sizes') > 0
    ) THEN
      IF coalesce(v_item.options->>'shoe_size', '') = '' THEN
        RAISE EXCEPTION 'Shoe size is required for product %', v_product.name_ku;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) v
        WHERE (
          jsonb_typeof(v->'shoe_sizes') = 'array'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(v->'shoe_sizes') s
            WHERE s = v_item.options->>'shoe_size'
          )
        )
        OR v->>'shoe_size' = v_item.options->>'shoe_size'
      ) THEN
        RAISE EXCEPTION
          'Selected shoe size % is not available for product %',
          v_item.options->>'shoe_size',
          v_product.name_ku;
      END IF;
    END IF;

    IF NOT coalesce(v_product.is_available, false)
       OR coalesce(v_product.stock, 0) < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product.name_ku;
    END IF;

    v_subtotal :=
      v_subtotal
      + coalesce(v_product.sale_price_iqd, v_product.price_iqd)
      * v_item.quantity;
  END LOOP;

  IF btrim(coalesce(p_coupon_code, '')) <> '' THEN
    SELECT *
    INTO v_coupon
    FROM public.coupons
    WHERE lower(btrim(code)) = lower(btrim(p_coupon_code))
    FOR UPDATE;

    IF NOT FOUND OR NOT coalesce(v_coupon.is_active, false) THEN
      RAISE EXCEPTION 'INVALID_COUPON';
    END IF;

    IF v_coupon.expires_at IS NOT NULL
       AND v_coupon.expires_at <= now() THEN
      RAISE EXCEPTION 'COUPON_EXPIRED';
    END IF;

    IF v_coupon.max_uses IS NOT NULL
       AND v_coupon.used_count >= v_coupon.max_uses THEN
      RAISE EXCEPTION 'COUPON_LIMIT_REACHED';
    END IF;

    IF v_coupon.discount_type = 'percent' THEN
      v_discount :=
        round(v_subtotal * v_coupon.discount_value / 100.0, 2);
    ELSE
      v_discount := v_coupon.discount_value;
    END IF;

    v_discount := least(greatest(0, v_discount), v_subtotal);
  END IF;

  v_total :=
    greatest(0, v_subtotal + v_delivery_fee + v_platform_fee - v_discount);

  IF lower(coalesce(p_payment_method, 'cash')) = 'referral_wallet' THEN
    INSERT INTO public.referral_wallets(user_id)
    VALUES (v_user)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT balance_iqd
    INTO v_referral_wallet_balance
    FROM public.referral_wallets
    WHERE user_id = v_user
    FOR UPDATE;

    IF coalesce(v_referral_wallet_balance, 0) < v_total THEN
      RAISE EXCEPTION 'INSUFFICIENT_REFERRAL_WALLET_BALANCE';
    END IF;
  ELSIF lower(coalesce(p_payment_method, 'cash')) = 'wallet' THEN
    INSERT INTO public.wallets(user_id)
    VALUES (v_user)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT balance_iqd
    INTO v_wallet_balance
    FROM public.wallets
    WHERE user_id = v_user
    FOR UPDATE;

    IF coalesce(v_wallet_balance, 0) < v_total THEN
      RAISE EXCEPTION 'INSUFFICIENT_WALLET_BALANCE';
    END IF;
  END IF;

  INSERT INTO public.orders (
    customer_id,
    store_id,
    status,
    address_id,
    subtotal_iqd,
    delivery_fee_iqd,
    platform_fee_iqd,
    discount_iqd,
    total_iqd,
    payment_status,
    payment_method,
    coupon_id
  )
  VALUES (
    v_user,
    p_store_id,
    'pending'::public.order_status,
    p_address_id,
    v_subtotal,
    v_delivery_fee,
    v_platform_fee,
    v_discount,
    v_total,
    CASE
      WHEN lower(coalesce(p_payment_method, 'cash'))
           IN ('wallet', 'referral_wallet')
        THEN 'paid'::public.payment_status
      ELSE 'pending'::public.payment_status
    END,
    lower(coalesce(p_payment_method, 'cash')),
    v_coupon.id
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN
    SELECT
      product_id,
      coalesce(options, '{}'::jsonb) AS options,
      referral_code,
      sum(quantity)::integer AS quantity
    FROM jsonb_to_recordset(p_items)
      AS x(product_id uuid, quantity integer, options jsonb, referral_code text)
    GROUP BY product_id, coalesce(options, '{}'::jsonb), referral_code
  LOOP
    SELECT *
    INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    INSERT INTO public.order_items (
      order_id,
      product_id,
      product_name,
      quantity,
      unit_price_iqd,
      options
    )
    VALUES (
      v_order_id,
      v_product.id,
      v_product.name_ku,
      v_item.quantity,
      coalesce(v_product.sale_price_iqd, v_product.price_iqd),
      v_item.options
    )
    RETURNING id INTO v_order_item_id;

    -- Referral attribution is handled exclusively by the AFTER INSERT trigger
    -- from the sharer-specific share code stored in __shakh_share_ref.
    -- Ignore the legacy post-level referral_code field so old clients cannot
    -- credit the original post owner.

    UPDATE public.products
    SET
      stock = greatest(0, coalesce(stock, 0) - v_item.quantity),
      is_available = CASE
        WHEN coalesce(stock, 0) - v_item.quantity <= 0 THEN false
        ELSE is_available
      END,
      updated_at = now()
    WHERE id = v_product.id;
  END LOOP;

  IF v_coupon.id IS NOT NULL THEN
    UPDATE public.coupons
    SET used_count = used_count + 1
    WHERE id = v_coupon.id;
  END IF;

  IF lower(coalesce(p_payment_method, 'cash')) = 'referral_wallet' THEN
    INSERT INTO public.referral_wallet_transactions (
      wallet_id,
      type,
      amount_iqd,
      reference_id,
      description
    )
    SELECT
      rw.id,
      'purchase',
      v_total,
      v_order_id,
      'کڕین بە قازانجی پۆستەکان بۆ ئۆردەر #' ||
      left(v_order_id::text, 8)
    FROM public.referral_wallets rw
    WHERE rw.user_id = v_user;

    UPDATE public.referral_wallets
    SET
      balance_iqd = balance_iqd - v_total,
      updated_at = now()
    WHERE user_id = v_user;
  ELSIF lower(coalesce(p_payment_method, 'cash')) = 'wallet' THEN
    INSERT INTO public.wallet_transactions (
      wallet_id,
      type,
      amount_iqd,
      reference_id,
      description
    )
    SELECT
      w.id,
      'debit'::public.wallet_tx_type,
      v_total,
      v_order_id,
      'پارەدانی Wallet بۆ ئۆردەر #' ||
      left(v_order_id::text, 8)
    FROM public.wallets w
    WHERE w.user_id = v_user;

    UPDATE public.wallets
    SET
      balance_iqd = balance_iqd - v_total,
      updated_at = now()
    WHERE user_id = v_user;
  END IF;

  RETURN v_order_id;
END;
$function$;


REVOKE ALL
  ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE
  ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text,text)
  TO authenticated;

COMMIT;
