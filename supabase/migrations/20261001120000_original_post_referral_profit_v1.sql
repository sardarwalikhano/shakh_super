-- SHAKH Stage 8: original-poster referral profit attribution.
-- A referral code is generated for every post and permanently belongs to posts.author_id.
-- Sharing the URL never transfers ownership of the referral code.
-- Earnings are created from delivered orders only; the commission rate is snapshotted
-- when the post is created so later platform-setting changes do not rewrite history.

BEGIN;

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS referral_commission_percent numeric(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.platform_settings
  DROP CONSTRAINT IF EXISTS platform_settings_referral_commission_percent_chk;

ALTER TABLE public.platform_settings
  ADD CONSTRAINT platform_settings_referral_commission_percent_chk
  CHECK (referral_commission_percent >= 0 AND referral_commission_percent <= 100);

-- When an installation already has a non-zero platform commission, use it as the
-- initial referral rate. Admins can change the dedicated setting afterwards.
UPDATE public.platform_settings
SET referral_commission_percent = commission_percent
WHERE id = true
  AND coalesce(referral_commission_percent, 0) = 0
  AND coalesce(commission_percent, 0) > 0;

CREATE TABLE IF NOT EXISTS public.post_referral_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL UNIQUE REFERENCES public.posts(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  commission_percent numeric(5,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_referral_programs_code_nonempty_chk CHECK (length(btrim(code)) >= 8),
  CONSTRAINT post_referral_programs_commission_range_chk
    CHECK (commission_percent >= 0 AND commission_percent <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS post_referral_programs_code_lower_key
  ON public.post_referral_programs (lower(btrim(code)));

CREATE INDEX IF NOT EXISTS post_referral_programs_owner_id_idx
  ON public.post_referral_programs(owner_id);

CREATE TABLE IF NOT EXISTS public.cart_post_referrals (
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  referral_program_id uuid NOT NULL REFERENCES public.post_referral_programs(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cart_id, product_id)
);

CREATE INDEX IF NOT EXISTS cart_post_referrals_program_id_idx
  ON public.cart_post_referrals(referral_program_id);

CREATE TABLE IF NOT EXISTS public.order_referral_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL UNIQUE REFERENCES public.order_items(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE RESTRICT,
  referral_program_id uuid NOT NULL REFERENCES public.post_referral_programs(id) ON DELETE RESTRICT,
  beneficiary_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  commission_percent numeric(5,2) NOT NULL,
  base_amount_iqd numeric(14,2) NOT NULL,
  earning_iqd numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  earned_at timestamptz NULL,
  CONSTRAINT order_referral_earnings_commission_range_chk
    CHECK (commission_percent >= 0 AND commission_percent <= 100),
  CONSTRAINT order_referral_earnings_amounts_nonnegative_chk
    CHECK (base_amount_iqd >= 0 AND earning_iqd >= 0),
  CONSTRAINT order_referral_earnings_status_chk
    CHECK (status IN ('pending','earned','cancelled')),
  CONSTRAINT order_referral_earnings_calculation_chk
    CHECK (earning_iqd = round(base_amount_iqd * commission_percent / 100.0, 2))
);

CREATE INDEX IF NOT EXISTS order_referral_earnings_beneficiary_status_idx
  ON public.order_referral_earnings(beneficiary_user_id, status, earned_at DESC);

CREATE INDEX IF NOT EXISTS order_referral_earnings_order_id_idx
  ON public.order_referral_earnings(order_id);

CREATE TABLE IF NOT EXISTS public.referral_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance_iqd numeric(14,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_wallets_balance_nonnegative_chk CHECK (balance_iqd >= 0)
);

CREATE TABLE IF NOT EXISTS public.referral_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.referral_wallets(id) ON DELETE CASCADE,
  type text NOT NULL,
  amount_iqd numeric(14,2) NOT NULL,
  reference_id uuid NULL,
  description text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_wallet_transactions_type_chk
    CHECK (type IN ('earning','purchase','withdrawal_reserve','withdrawal_refund')),
  CONSTRAINT referral_wallet_transactions_amount_positive_chk
    CHECK (amount_iqd > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS referral_wallet_transactions_reference_key
  ON public.referral_wallet_transactions(wallet_id, type, reference_id)
  WHERE reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS referral_wallet_transactions_wallet_created_idx
  ON public.referral_wallet_transactions(wallet_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.referral_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount_iqd numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  note text NULL,
  admin_note text NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  processed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT referral_withdrawal_requests_amount_positive_chk CHECK (amount_iqd > 0),
  CONSTRAINT referral_withdrawal_requests_status_chk
    CHECK (status IN ('pending','approved','rejected'))
);

CREATE INDEX IF NOT EXISTS referral_withdrawal_requests_user_idx
  ON public.referral_withdrawal_requests(user_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS referral_withdrawal_requests_status_idx
  ON public.referral_withdrawal_requests(status, requested_at DESC);

-- Generate one immutable code per post. The code is owned by posts.author_id.
CREATE OR REPLACE FUNCTION private.generate_post_referral_program()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_percent numeric(5,2) := 0;
  v_code text;
BEGIN
  SELECT coalesce(referral_commission_percent, 0)
  INTO v_percent
  FROM public.platform_settings
  WHERE id = true;

  LOOP
    v_code := 'SHK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.post_referral_programs
      WHERE code = v_code
    );
  END LOOP;

  INSERT INTO public.post_referral_programs(
    post_id, owner_id, code, commission_percent, is_active
  )
  VALUES(
    NEW.id,
    NEW.author_id,
    v_code,
    least(100, greatest(0, coalesce(v_percent, 0))),
    true
  )
  ON CONFLICT (post_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_post_referral_program ON public.posts;
CREATE TRIGGER trg_generate_post_referral_program
AFTER INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION private.generate_post_referral_program();

-- Backfill all existing posts that do not yet have a referral program.
DO $$
DECLARE
  row_data record;
  v_percent numeric(5,2) := 0;
  v_code text;
BEGIN
  SELECT coalesce(referral_commission_percent, 0)
  INTO v_percent
  FROM public.platform_settings
  WHERE id = true;

  FOR row_data IN
    SELECT p.id, p.author_id
    FROM public.posts p
    LEFT JOIN public.post_referral_programs rp ON rp.post_id = p.id
    WHERE rp.id IS NULL
  LOOP
    LOOP
      v_code := 'SHK-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.post_referral_programs WHERE code = v_code
      );
    END LOOP;

    INSERT INTO public.post_referral_programs(
      post_id, owner_id, code, commission_percent, is_active
    )
    VALUES(
      row_data.id,
      row_data.author_id,
      v_code,
      least(100, greatest(0, coalesce(v_percent, 0))),
      true
    )
    ON CONFLICT (post_id) DO NOTHING;
  END LOOP;
END;
$$;

ALTER TABLE public.post_referral_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_post_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_referral_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_withdrawal_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.post_referral_programs FROM anon, authenticated;
GRANT SELECT (post_id, code, commission_percent, is_active, created_at)
  ON public.post_referral_programs TO anon, authenticated;

DROP POLICY IF EXISTS post_referral_programs_public_select ON public.post_referral_programs;
CREATE POLICY post_referral_programs_public_select
ON public.post_referral_programs
FOR SELECT
TO public
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.posts p
      WHERE p.id = post_referral_programs.post_id
        AND p.status = 'approved'
        AND p.visibility = 'public'
        AND p.archived_at IS NULL
    )
  )
  OR post_referral_programs.owner_id = (SELECT auth.uid())
  OR (SELECT public.is_admin())
);

REVOKE ALL ON TABLE public.cart_post_referrals FROM anon;
GRANT SELECT, INSERT, DELETE ON TABLE public.cart_post_referrals TO authenticated;

DROP POLICY IF EXISTS cart_post_referrals_select_own ON public.cart_post_referrals;
CREATE POLICY cart_post_referrals_select_own
ON public.cart_post_referrals
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.carts c
    WHERE c.id = cart_post_referrals.cart_id
      AND c.user_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS cart_post_referrals_insert_own ON public.cart_post_referrals;
CREATE POLICY cart_post_referrals_insert_own
ON public.cart_post_referrals
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.carts c
    WHERE c.id = cart_post_referrals.cart_id
      AND c.user_id = (SELECT auth.uid())
  )
  AND EXISTS (
    SELECT 1
    FROM public.post_referral_programs rp
    WHERE rp.id = cart_post_referrals.referral_program_id
      AND rp.owner_id IS DISTINCT FROM (SELECT auth.uid())
      AND rp.is_active = true
      AND EXISTS (
        SELECT 1
        FROM public.posts p
        WHERE p.id = rp.post_id
          AND p.status = 'approved'
          AND p.visibility = 'public'
          AND p.archived_at IS NULL
          AND p.listing_details->>'product_id' = cart_post_referrals.product_id::text
      )
  )
);

DROP POLICY IF EXISTS cart_post_referrals_delete_own ON public.cart_post_referrals;
CREATE POLICY cart_post_referrals_delete_own
ON public.cart_post_referrals
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.carts c
    WHERE c.id = cart_post_referrals.cart_id
      AND c.user_id = (SELECT auth.uid())
  )
);

REVOKE ALL ON TABLE public.order_referral_earnings FROM anon, authenticated;
GRANT SELECT ON TABLE public.order_referral_earnings TO authenticated;

DROP POLICY IF EXISTS order_referral_earnings_select_own ON public.order_referral_earnings;
CREATE POLICY order_referral_earnings_select_own
ON public.order_referral_earnings
FOR SELECT TO authenticated
USING (
  beneficiary_user_id = (SELECT auth.uid())
  OR (SELECT public.is_admin())
);

REVOKE ALL ON TABLE public.referral_wallets FROM anon, authenticated;
GRANT SELECT ON TABLE public.referral_wallets TO authenticated;

DROP POLICY IF EXISTS referral_wallets_select_own ON public.referral_wallets;
CREATE POLICY referral_wallets_select_own
ON public.referral_wallets
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT public.is_admin())
);

REVOKE ALL ON TABLE public.referral_wallet_transactions FROM anon, authenticated;
GRANT SELECT ON TABLE public.referral_wallet_transactions TO authenticated;

DROP POLICY IF EXISTS referral_wallet_transactions_select_own ON public.referral_wallet_transactions;
CREATE POLICY referral_wallet_transactions_select_own
ON public.referral_wallet_transactions
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.referral_wallets rw
    WHERE rw.id = referral_wallet_transactions.wallet_id
      AND rw.user_id = (SELECT auth.uid())
  )
  OR (SELECT public.is_admin())
);

REVOKE ALL ON TABLE public.referral_withdrawal_requests FROM anon, authenticated;
GRANT SELECT ON TABLE public.referral_withdrawal_requests TO authenticated;

DROP POLICY IF EXISTS referral_withdrawal_requests_select_own ON public.referral_withdrawal_requests;
CREATE POLICY referral_withdrawal_requests_select_own
ON public.referral_withdrawal_requests
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT public.is_admin())
);

-- Server-only order attribution + referral-wallet payment.
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

  IF p_address_id IS NULL OR NOT EXISTS (
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
     NOT IN ('cash','wallet','referral_wallet') THEN
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

    IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at <= now() THEN
      RAISE EXCEPTION 'COUPON_EXPIRED';
    END IF;

    IF v_coupon.max_uses IS NOT NULL
       AND v_coupon.used_count >= v_coupon.max_uses THEN
      RAISE EXCEPTION 'COUPON_LIMIT_REACHED';
    END IF;

    IF v_coupon.discount_type = 'percent' THEN
      v_discount := round(v_subtotal * v_coupon.discount_value / 100.0, 2);
    ELSE
      v_discount := v_coupon.discount_value;
    END IF;

    v_discount := least(greatest(0, v_discount), v_subtotal);
  END IF;

  v_total := greatest(0, v_subtotal + v_delivery_fee + v_platform_fee - v_discount);

  IF lower(coalesce(p_payment_method, 'cash')) = 'referral_wallet' THEN
    INSERT INTO public.referral_wallets(user_id)
    VALUES(v_user)
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
    VALUES(v_user)
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
      WHEN lower(coalesce(p_payment_method, 'cash')) IN ('wallet','referral_wallet')
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

    -- The buyer can submit only a code. The code itself resolves to the
    -- immutable original post owner. A later sharer cannot become the beneficiary.
    v_referral_program_id := NULL;
    v_referral_post_id := NULL;
    v_referral_owner := NULL;
    v_referral_percent := 0;

    IF btrim(coalesce(v_item.referral_code, '')) <> '' THEN
      SELECT
        rp.id,
        rp.post_id,
        rp.owner_id,
        rp.commission_percent
      INTO
        v_referral_program_id,
        v_referral_post_id,
        v_referral_owner,
        v_referral_percent
      FROM public.post_referral_programs rp
      JOIN public.posts p
        ON p.id = rp.post_id
      WHERE lower(btrim(rp.code)) = lower(btrim(v_item.referral_code))
        AND rp.is_active = true
        AND rp.owner_id IS DISTINCT FROM v_user
        AND p.status = 'approved'
        AND p.visibility = 'public'
        AND p.archived_at IS NULL
        AND p.listing_details->>'product_id' = v_product.id::text
      LIMIT 1;

      IF v_referral_program_id IS NOT NULL THEN
        v_referral_base :=
          coalesce(v_product.sale_price_iqd, v_product.price_iqd)
          * v_item.quantity;

        v_referral_earning :=
          round(v_referral_base * v_referral_percent / 100.0, 2);

        INSERT INTO public.order_referral_earnings (
          order_id,
          order_item_id,
          post_id,
          referral_program_id,
          beneficiary_user_id,
          commission_percent,
          base_amount_iqd,
          earning_iqd,
          status
        )
        VALUES (
          v_order_id,
          v_order_item_id,
          v_referral_post_id,
          v_referral_program_id,
          v_referral_owner,
          v_referral_percent,
          v_referral_base,
          v_referral_earning,
          'pending'
        )
        ON CONFLICT (order_item_id) DO NOTHING;
      END IF;
    END IF;

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
    INSERT INTO public.referral_wallet_transactions(
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
      'کڕین بە قازانجی پۆستەکان بۆ ئۆردەر #' || left(v_order_id::text, 8)
    FROM public.referral_wallets rw
    WHERE rw.user_id = v_user;

    UPDATE public.referral_wallets
    SET balance_iqd = balance_iqd - v_total,
        updated_at = now()
    WHERE user_id = v_user;
  ELSIF lower(coalesce(p_payment_method, 'cash')) = 'wallet' THEN
    INSERT INTO public.wallet_transactions(
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
      'پارەدانی Wallet بۆ ئۆردەر #' || left(v_order_id::text, 8)
    FROM public.wallets w
    WHERE w.user_id = v_user;

    UPDATE public.wallets
    SET balance_iqd = balance_iqd - v_total,
        updated_at = now()
    WHERE user_id = v_user;
  END IF;

  RETURN v_order_id;
END;
$function$;

REVOKE ALL ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text,text) TO authenticated;

-- Ensure the legacy private overloads keep using the secure five-argument implementation.
CREATE OR REPLACE FUNCTION private.create_order_with_stock(
  p_store_id uuid,
  p_address_id uuid,
  p_items jsonb,
  p_payment_method text
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.create_order_with_stock(
    p_store_id,
    p_address_id,
    p_items,
    p_payment_method,
    NULL
  );
$$;

CREATE OR REPLACE FUNCTION private.create_order_with_stock(
  p_store_id uuid,
  p_address_id uuid,
  p_items jsonb
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.create_order_with_stock(
    p_store_id,
    p_address_id,
    p_items,
    'cash',
    NULL
  );
$$;

REVOKE ALL ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb) TO authenticated;

-- Credit the original poster only when the order is actually delivered.
CREATE OR REPLACE FUNCTION private.settle_post_referral_earnings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  r record;
  v_wallet_id uuid;
  v_tx_inserted integer := 0;
BEGIN
  IF NEW.status = 'delivered'::public.order_status
     AND OLD.status IS DISTINCT FROM NEW.status THEN

    FOR r IN
      SELECT *
      FROM public.order_referral_earnings
      WHERE order_id = NEW.id
        AND status = 'pending'
      FOR UPDATE
    LOOP
      INSERT INTO public.referral_wallets(user_id)
      VALUES(r.beneficiary_user_id)
      ON CONFLICT (user_id) DO NOTHING;

      SELECT id
      INTO v_wallet_id
      FROM public.referral_wallets
      WHERE user_id = r.beneficiary_user_id
      FOR UPDATE;

      IF r.earning_iqd > 0 THEN
        INSERT INTO public.referral_wallet_transactions(
          wallet_id,
          type,
          amount_iqd,
          reference_id,
          description
        )
        VALUES(
          v_wallet_id,
          'earning',
          r.earning_iqd,
          r.id,
          'قازانجی پۆست بۆ ئۆردەر #' || left(NEW.id::text, 8)
        )
        ON CONFLICT (wallet_id, type, reference_id) DO NOTHING;

        GET DIAGNOSTICS v_tx_inserted = ROW_COUNT;

        IF v_tx_inserted = 1 THEN
          UPDATE public.referral_wallets
          SET balance_iqd = balance_iqd + r.earning_iqd,
              updated_at = now()
          WHERE id = v_wallet_id;
        END IF;
      END IF;

      UPDATE public.order_referral_earnings
      SET status = 'earned',
          earned_at = now()
      WHERE id = r.id
        AND status = 'pending';
    END LOOP;

  ELSIF NEW.status = 'cancelled'::public.order_status
        AND OLD.status IS DISTINCT FROM NEW.status THEN

    UPDATE public.order_referral_earnings
    SET status = 'cancelled'
    WHERE order_id = NEW.id
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.settle_post_referral_earnings() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_settle_post_referral_earnings ON public.orders;
CREATE TRIGGER trg_settle_post_referral_earnings
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
WHEN (
  OLD.status IS DISTINCT FROM NEW.status
  AND NEW.status IN ('delivered','cancelled')
)
EXECUTE FUNCTION private.settle_post_referral_earnings();

-- Create the referral wallet on demand and support monthly withdrawals.
CREATE OR REPLACE FUNCTION private.request_referral_withdrawal(
  p_amount_iqd numeric,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_balance numeric := 0;
  v_request_id uuid;
  v_wallet_id uuid;
  admin_user record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF coalesce(p_amount_iqd, 0) <= 0 THEN
    RAISE EXCEPTION 'INVALID_WITHDRAWAL_AMOUNT';
  END IF;

  INSERT INTO public.referral_wallets(user_id)
  VALUES(v_user)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT id, balance_iqd
  INTO v_wallet_id, v_balance
  FROM public.referral_wallets
  WHERE user_id = v_user
  FOR UPDATE;

  IF v_balance < p_amount_iqd THEN
    RAISE EXCEPTION 'INSUFFICIENT_REFERRAL_WALLET_BALANCE';
  END IF;

  INSERT INTO public.referral_withdrawal_requests(
    user_id, amount_iqd, status, note
  )
  VALUES(
    v_user, round(p_amount_iqd, 2), 'pending', nullif(btrim(p_note), '')
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.referral_wallet_transactions(
    wallet_id, type, amount_iqd, reference_id, description
  )
  VALUES(
    v_wallet_id,
    'withdrawal_reserve',
    round(p_amount_iqd, 2),
    v_request_id,
    'داواکاری دەرکردنی قازانجی پۆست'
  );

  UPDATE public.referral_wallets
  SET balance_iqd = balance_iqd - round(p_amount_iqd, 2),
      updated_at = now()
  WHERE id = v_wallet_id;

  FOR admin_user IN
    SELECT id
    FROM public.profiles
    WHERE role IN ('super_admin','admin')
      AND id IS DISTINCT FROM v_user
  LOOP
    INSERT INTO public.notifications(
      user_id, title, body, type, is_read, data
    )
    VALUES(
      admin_user.id,
      'داواکاری دەرکردنی قازانجی پۆست',
      'داواکارییەکی نوێ بۆ دەرکردنی قازانجی پۆست هەیە.',
      'referral_withdrawal',
      false,
      jsonb_build_object(
        'request_id', v_request_id,
        'user_id', v_user,
        'amount_iqd', round(p_amount_iqd, 2)
      )
    );
  END LOOP;

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.process_referral_withdrawal(
  p_request_id uuid,
  p_approve boolean,
  p_admin_note text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.referral_withdrawal_requests%rowtype;
  v_wallet_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  SELECT *
  INTO v_request
  FROM public.referral_withdrawal_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal_request_not_found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RETURN true;
  END IF;

  IF p_approve THEN
    UPDATE public.referral_withdrawal_requests
    SET status = 'approved',
        admin_note = nullif(btrim(p_admin_note), ''),
        processed_at = now(),
        processed_by = auth.uid()
    WHERE id = v_request.id;
  ELSE
    INSERT INTO public.referral_wallets(user_id)
    VALUES(v_request.user_id)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT id
    INTO v_wallet_id
    FROM public.referral_wallets
    WHERE user_id = v_request.user_id
    FOR UPDATE;

    INSERT INTO public.referral_wallet_transactions(
      wallet_id, type, amount_iqd, reference_id, description
    )
    VALUES(
      v_wallet_id,
      'withdrawal_refund',
      v_request.amount_iqd,
      v_request.id,
      'گەڕانەوەی قازانجی دەرنەکراو'
    )
    ON CONFLICT (wallet_id, type, reference_id) DO NOTHING;

    UPDATE public.referral_wallets
    SET balance_iqd = balance_iqd + v_request.amount_iqd,
        updated_at = now()
    WHERE id = v_wallet_id;

    UPDATE public.referral_withdrawal_requests
    SET status = 'rejected',
        admin_note = nullif(btrim(p_admin_note), ''),
        processed_at = now(),
        processed_by = auth.uid()
    WHERE id = v_request.id;
  END IF;

  INSERT INTO public.notifications(
    user_id, title, body, type, is_read, data
  )
  VALUES(
    v_request.user_id,
    CASE WHEN p_approve
      THEN 'داواکاری قازانج پەسەند کرا'
      ELSE 'داواکاری قازانج ڕەتکرایەوە'
    END,
    CASE WHEN p_approve
      THEN 'داواکاری دەرکردنی قازانجەکەت پەسەند کرا.'
      ELSE 'داواکاری دەرکردنی قازانجەکەت ڕەتکرایەوە و بڕەکە گەڕێندرایەوە ناو جزدان.'
    END,
    'referral_withdrawal',
    false,
    jsonb_build_object(
      'request_id', v_request.id,
      'status', CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      'amount_iqd', v_request.amount_iqd
    )
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.request_referral_withdrawal(numeric,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.process_referral_withdrawal(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.request_referral_withdrawal(numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.process_referral_withdrawal(uuid,boolean,text) TO authenticated;

-- Public compatibility wrappers use the same private-security pattern as the existing
-- order RPCs while exposing only authenticated actions.
CREATE OR REPLACE FUNCTION public.request_referral_withdrawal(
  p_amount_iqd numeric,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.request_referral_withdrawal(p_amount_iqd, p_note);
$$;

CREATE OR REPLACE FUNCTION public.process_referral_withdrawal(
  p_request_id uuid,
  p_approve boolean,
  p_admin_note text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.process_referral_withdrawal(
    p_request_id,
    p_approve,
    p_admin_note
  );
$$;

REVOKE ALL ON FUNCTION public.request_referral_withdrawal(numeric,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.process_referral_withdrawal(uuid,boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_referral_withdrawal(numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_referral_withdrawal(uuid,boolean,text) TO authenticated;

COMMIT;
