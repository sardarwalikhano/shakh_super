-- SHAKH Referral v2:
-- A post defines the reward percentage.
-- Every sharer receives a unique share link for that post.
-- Orders attributed to that share link credit the sharer, not the original post owner.
-- The reward is settled only when the order becomes delivered.

BEGIN;

CREATE TABLE IF NOT EXISTS public.post_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  referral_program_id uuid NOT NULL REFERENCES public.post_referral_programs(id) ON DELETE RESTRICT,
  sharer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT post_share_links_code_nonempty_chk
    CHECK (length(btrim(code)) >= 8),
  CONSTRAINT post_share_links_post_sharer_unique
    UNIQUE (post_id, sharer_id)
);

CREATE INDEX IF NOT EXISTS post_share_links_sharer_idx
  ON public.post_share_links(sharer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS post_share_links_post_idx
  ON public.post_share_links(post_id, created_at DESC);

ALTER TABLE public.post_share_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.post_share_links FROM anon, authenticated;

-- The Data API does not need to expose sharer_id or the internal program id.
-- Share links are created/resolved through protected database functions.
GRANT SELECT (id, post_id, code, is_active, created_at)
  ON public.post_share_links TO authenticated;

DROP POLICY IF EXISTS post_share_links_select_own ON public.post_share_links;
CREATE POLICY post_share_links_select_own
ON public.post_share_links
FOR SELECT
TO authenticated
USING (sharer_id = (select auth.uid()) OR (select public.is_admin()));

-- Prevent public clients from reading internal per-post program codes.
REVOKE SELECT (code) ON public.post_referral_programs FROM anon, authenticated;
GRANT SELECT (post_id, commission_percent, is_active, created_at)
  ON public.post_referral_programs TO anon, authenticated;

-- The reward is chosen when the post is created. The platform setting remains the
-- default, while an explicit listing_details.referral_reward_percent overrides it.
CREATE OR REPLACE FUNCTION private.generate_post_referral_program()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_percent numeric(5,2) := NULL;
  v_code text;
BEGIN
  v_percent := NULLIF(
    btrim(coalesce(NEW.listing_details->>'referral_reward_percent', '')),
    ''
  )::numeric;

  IF v_percent IS NULL THEN
    SELECT coalesce(referral_commission_percent, 0)
    INTO v_percent
    FROM public.platform_settings
    WHERE id = true;
  END IF;

  v_percent := least(100, greatest(0, coalesce(v_percent, 0)));

  LOOP
    v_code :=
      'SHK-P-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.post_referral_programs
      WHERE code = v_code
    );
  END LOOP;

  INSERT INTO public.post_referral_programs(
    post_id,
    owner_id,
    code,
    commission_percent,
    is_active
  )
  VALUES(
    NEW.id,
    NEW.author_id,
    v_code,
    v_percent,
    true
  )
  ON CONFLICT (post_id) DO UPDATE
    SET owner_id = EXCLUDED.owner_id,
        commission_percent = EXCLUDED.commission_percent,
        is_active = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_post_referral_program ON public.posts;
CREATE TRIGGER trg_generate_post_referral_program
AFTER INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION private.generate_post_referral_program();

-- Create one stable affiliate/share URL per user per post.
CREATE OR REPLACE FUNCTION private.create_post_share_link(
  p_post_id uuid
)
RETURNS TABLE(
  share_link_id uuid,
  post_id uuid,
  code text,
  reward_percent numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_program public.post_referral_programs%rowtype;
  v_existing public.post_share_links%rowtype;
  v_code text;
  v_post public.posts%rowtype;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  SELECT *
  INTO v_post
  FROM public.posts
  WHERE id = p_post_id
    AND status = 'approved'
    AND visibility = 'public'
    AND archived_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'post_not_shareable';
  END IF;

  SELECT *
  INTO v_program
  FROM public.post_referral_programs
  WHERE post_id = p_post_id
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'post_reward_not_configured';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.post_share_links
  WHERE post_id = p_post_id
    AND sharer_id = v_user
    AND is_active = true
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      v_existing.id,
      v_existing.post_id,
      v_existing.code,
      v_program.commission_percent;
    RETURN;
  END IF;

  LOOP
    v_code :=
      'SHK-S-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.post_share_links
      WHERE code = v_code
    );
  END LOOP;

  INSERT INTO public.post_share_links(
    post_id,
    referral_program_id,
    sharer_id,
    code,
    is_active
  )
  VALUES(
    p_post_id,
    v_program.id,
    v_user,
    v_code,
    true
  )
  ON CONFLICT (post_id, sharer_id) DO UPDATE
    SET is_active = true
  RETURNING * INTO v_existing;

  RETURN QUERY
  SELECT
    v_existing.id,
    v_existing.post_id,
    v_existing.code,
    v_program.commission_percent;
END;
$$;

REVOKE ALL ON FUNCTION private.create_post_share_link(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.create_post_share_link(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.create_post_share_link(
  p_post_id uuid
)
RETURNS TABLE(
  share_link_id uuid,
  post_id uuid,
  code text,
  reward_percent numeric
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT *
  FROM private.create_post_share_link(p_post_id);
$$;

REVOKE ALL ON FUNCTION public.create_post_share_link(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_post_share_link(uuid)
  TO authenticated;

-- A cart keeps the exact share link that caused the product to enter the cart.
-- This is deliberately separate from the old post-level referral table.
CREATE TABLE IF NOT EXISTS public.cart_post_share_attributions (
  cart_id uuid NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  share_link_id uuid NOT NULL REFERENCES public.post_share_links(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cart_id, product_id)
);

CREATE INDEX IF NOT EXISTS cart_post_share_attributions_share_link_idx
  ON public.cart_post_share_attributions(share_link_id);

ALTER TABLE public.cart_post_share_attributions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.cart_post_share_attributions FROM anon;
GRANT SELECT, INSERT, DELETE
  ON public.cart_post_share_attributions TO authenticated;

DROP POLICY IF EXISTS cart_post_share_attributions_select_own
  ON public.cart_post_share_attributions;
CREATE POLICY cart_post_share_attributions_select_own
ON public.cart_post_share_attributions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.carts c
    WHERE c.id = cart_post_share_attributions.cart_id
      AND c.user_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS cart_post_share_attributions_insert_own
  ON public.cart_post_share_attributions;
CREATE POLICY cart_post_share_attributions_insert_own
ON public.cart_post_share_attributions
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.carts c
    WHERE c.id = cart_post_share_attributions.cart_id
      AND c.user_id = (select auth.uid())
  )
  AND EXISTS (
    SELECT 1
    FROM public.post_share_links sl
    JOIN public.post_referral_programs rp
      ON rp.id = sl.referral_program_id
    JOIN public.posts p
      ON p.id = sl.post_id
    WHERE sl.id = cart_post_share_attributions.share_link_id
      AND sl.is_active = true
      AND rp.is_active = true
      AND p.status = 'approved'
      AND p.visibility = 'public'
      AND p.archived_at IS NULL
      AND p.listing_details->>'product_id' =
          cart_post_share_attributions.product_id::text
  )
);

DROP POLICY IF EXISTS cart_post_share_attributions_delete_own
  ON public.cart_post_share_attributions;
CREATE POLICY cart_post_share_attributions_delete_own
ON public.cart_post_share_attributions
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.carts c
    WHERE c.id = cart_post_share_attributions.cart_id
      AND c.user_id = (select auth.uid())
  )
);

-- Keep the order earnings table compatible with the original system, but record
-- the specific sharer link and credit the sharer account.
ALTER TABLE public.order_referral_earnings
  ADD COLUMN IF NOT EXISTS share_link_id uuid
    REFERENCES public.post_share_links(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS order_referral_earnings_share_link_idx
  ON public.order_referral_earnings(share_link_id);

-- The order-item trigger is intentionally additive: it preserves the existing
-- secure order RPC, stock reservation, coupon, wallet and order lifecycle logic.
-- The frontend places the share code in the transient order-item options payload.
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
  v_earning numeric;
BEGIN
  v_code := nullif(btrim(coalesce(NEW.options->>'__shakh_share_ref', '')), '');

  IF v_code IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT sl.*
  INTO v_share
  FROM public.post_share_links sl
  WHERE lower(btrim(sl.code)) = lower(v_code)
    AND sl.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT rp.*
  INTO v_program
  FROM public.post_referral_programs rp
  WHERE rp.id = v_share.referral_program_id
    AND rp.is_active = true
  LIMIT 1;

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

  v_earning :=
    round(
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
    SET
      share_link_id = EXCLUDED.share_link_id,
      beneficiary_user_id = EXCLUDED.beneficiary_user_id,
      commission_percent = EXCLUDED.commission_percent,
      base_amount_iqd = EXCLUDED.base_amount_iqd,
      earning_iqd = EXCLUDED.earning_iqd,
      status = CASE
        WHEN public.order_referral_earnings.status = 'cancelled'
          THEN public.order_referral_earnings.status
        ELSE EXCLUDED.status
      END;

  -- Do not persist the share code in order item metadata.
  UPDATE public.order_items
  SET options = options - '__shakh_share_ref'
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attribute_order_item_to_share
  ON public.order_items;

CREATE TRIGGER trg_attribute_order_item_to_share
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION private.attribute_order_item_to_share();

REVOKE ALL
  ON FUNCTION private.attribute_order_item_to_share()
  FROM PUBLIC, anon, authenticated;


ALTER TABLE public.cart_post_share_attributions
  ADD COLUMN IF NOT EXISTS share_code text;

-- Securely attach a share link to the caller's own cart without exposing the
-- sharer's account or requiring a client-side lookup.
CREATE OR REPLACE FUNCTION private.attach_post_share_to_cart(
  p_cart_id uuid,
  p_product_id uuid,
  p_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_share public.post_share_links%rowtype;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.carts c
    WHERE c.id = p_cart_id
      AND c.user_id = v_user
  ) THEN
    RAISE EXCEPTION 'cart_not_owned';
  END IF;

  SELECT sl.*
  INTO v_share
  FROM public.post_share_links sl
  JOIN public.post_referral_programs rp
    ON rp.id = sl.referral_program_id
  JOIN public.posts p
    ON p.id = sl.post_id
  WHERE lower(btrim(sl.code)) = lower(btrim(coalesce(p_code, '')))
    AND sl.is_active = true
    AND rp.is_active = true
    AND p.status = 'approved'
    AND p.visibility = 'public'
    AND p.archived_at IS NULL
    AND p.listing_details->>'product_id' = p_product_id::text
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  INSERT INTO public.cart_post_share_attributions(
    cart_id,
    product_id,
    share_link_id,
    share_code
  )
  VALUES(
    p_cart_id,
    p_product_id,
    v_share.id,
    v_share.code
  )
  ON CONFLICT (cart_id, product_id) DO UPDATE
    SET share_link_id = EXCLUDED.share_link_id,
        share_code = EXCLUDED.share_code;

  RETURN true;
END;
$$;

REVOKE ALL
  ON FUNCTION private.attach_post_share_to_cart(uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE
  ON FUNCTION private.attach_post_share_to_cart(uuid,uuid,text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.attach_post_share_to_cart(
  p_cart_id uuid,
  p_product_id uuid,
  p_code text
)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.attach_post_share_to_cart(
    p_cart_id,
    p_product_id,
    p_code
  );
$$;

REVOKE ALL
  ON FUNCTION public.attach_post_share_to_cart(uuid,uuid,text)
  FROM PUBLIC, anon;
GRANT EXECUTE
  ON FUNCTION public.attach_post_share_to_cart(uuid,uuid,text)
  TO authenticated;


COMMIT;
