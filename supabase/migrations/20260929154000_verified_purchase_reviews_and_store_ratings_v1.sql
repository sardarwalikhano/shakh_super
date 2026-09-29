-- SHAKH Stage 9A: verified purchase reviews and aggregate store ratings.

REVOKE INSERT, UPDATE, DELETE ON TABLE public.reviews FROM anon;
GRANT SELECT ON TABLE public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.reviews TO authenticated;

DROP POLICY IF EXISTS reviews_public ON public.reviews;
DROP POLICY IF EXISTS reviews_self ON public.reviews;
DROP POLICY IF EXISTS reviews_owner ON public.reviews;
DROP POLICY IF EXISTS reviews_update_self ON public.reviews;
DROP POLICY IF EXISTS reviews_delete_self ON public.reviews;

CREATE POLICY reviews_public
  ON public.reviews FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY reviews_insert_verified_purchase
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND order_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = reviews.order_id
        AND o.customer_id = (select auth.uid())
        AND o.status = 'delivered'::public.order_status
        AND (reviews.store_id IS NULL OR reviews.store_id = o.store_id)
        AND (
          reviews.product_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.order_items oi
            WHERE oi.order_id = o.id
              AND oi.product_id = reviews.product_id
          )
        )
    )
    AND (store_id IS NOT NULL OR product_id IS NOT NULL)
  );

CREATE POLICY reviews_update_self
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()) OR (select is_admin()))
  WITH CHECK (user_id = (select auth.uid()) OR (select is_admin()));

CREATE POLICY reviews_delete_self
  ON public.reviews FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()) OR (select is_admin()));

DROP INDEX IF EXISTS public.reviews_one_per_user_order;
CREATE UNIQUE INDEX reviews_one_per_user_order_product
  ON public.reviews(user_id, order_id, product_id)
  WHERE order_id IS NOT NULL AND product_id IS NOT NULL;

CREATE UNIQUE INDEX reviews_one_store_review_per_user_order
  ON public.reviews(user_id, order_id)
  WHERE order_id IS NOT NULL AND product_id IS NULL;

CREATE OR REPLACE FUNCTION public.validate_review_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_store_id uuid;
BEGIN
  IF NEW.order_id IS NULL THEN
    RAISE EXCEPTION 'REVIEW_ORDER_REQUIRED';
  END IF;

  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'REVIEW_RATING_OUT_OF_RANGE';
  END IF;

  SELECT o.store_id INTO v_store_id
  FROM public.orders o
  WHERE o.id = NEW.order_id
    AND o.customer_id = NEW.user_id
    AND o.status = 'delivered'::public.order_status;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'REVIEW_ORDER_NOT_ELIGIBLE';
  END IF;

  IF NEW.store_id IS NULL AND NEW.product_id IS NULL THEN
    RAISE EXCEPTION 'REVIEW_TARGET_REQUIRED';
  END IF;

  IF NEW.store_id IS NOT NULL AND NEW.store_id <> v_store_id THEN
    RAISE EXCEPTION 'REVIEW_STORE_MISMATCH';
  END IF;

  IF NEW.product_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.order_items oi
    WHERE oi.order_id = NEW.order_id AND oi.product_id = NEW.product_id
  ) THEN
    RAISE EXCEPTION 'REVIEW_PRODUCT_NOT_IN_ORDER';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.refresh_store_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  old_store uuid := NULL;
  new_store uuid := NULL;
BEGIN
  IF tg_op = 'DELETE' OR tg_op = 'UPDATE' THEN old_store := OLD.store_id; END IF;
  IF tg_op = 'INSERT' OR tg_op = 'UPDATE' THEN new_store := NEW.store_id; END IF;

  IF old_store IS NOT NULL THEN
    UPDATE public.stores
    SET rating = COALESCE(
      (SELECT ROUND(AVG(r.rating)::numeric, 2) FROM public.reviews r WHERE r.store_id = old_store), 0
    ),
    updated_at = now()
    WHERE id = old_store;
  END IF;

  IF new_store IS NOT NULL AND new_store IS DISTINCT FROM old_store THEN
    UPDATE public.stores
    SET rating = COALESCE(
      (SELECT ROUND(AVG(r.rating)::numeric, 2) FROM public.reviews r WHERE r.store_id = new_store), 0
    ),
    updated_at = now()
    WHERE id = new_store;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE ALL ON FUNCTION public.validate_review_target() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.refresh_store_rating() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS trg_validate_review_target ON public.reviews;
CREATE TRIGGER trg_validate_review_target
BEFORE INSERT OR UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.validate_review_target();

DROP TRIGGER IF EXISTS trg_refresh_store_rating ON public.reviews;
CREATE TRIGGER trg_refresh_store_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.refresh_store_rating();
