-- SHAKH: per-variant inventory with atomic checkout/cancellation.
-- Uses the existing products.variants JSONB contract; no new table or products
-- column is required. Legacy products without variant_inventory keep global stock.

BEGIN;

CREATE OR REPLACE FUNCTION private.resolve_variant_inventory(
  p_variants jsonb,
  p_options jsonb
)
RETURNS TABLE(
  found boolean,
  has_inventory boolean,
  stock integer,
  unlimited boolean
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $function$
DECLARE
  v_row jsonb;
  v_has_inventory boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(coalesce(p_variants, '[]'::jsonb)) AS variant(value)
    WHERE pg_catalog.jsonb_typeof(variant.value->'variant_inventory') = 'array'
      AND pg_catalog.jsonb_array_length(variant.value->'variant_inventory') > 0
  )
  INTO v_has_inventory;

  SELECT row.value
  INTO v_row
  FROM pg_catalog.jsonb_array_elements(coalesce(p_variants, '[]'::jsonb)) AS variant(value)
  CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
    CASE
      WHEN pg_catalog.jsonb_typeof(variant.value->'variant_inventory') = 'array'
      THEN variant.value->'variant_inventory'
      ELSE '[]'::jsonb
    END
  ) AS row(value)
  WHERE (
          coalesce(btrim(row.value->>'size'), '') = ''
          OR coalesce(btrim(row.value->>'size'), '') = coalesce(btrim(p_options->>'size'), '')
        )
    AND (
          coalesce(btrim(row.value->>'shoe_size'), '') = ''
          OR coalesce(btrim(row.value->>'shoe_size'), '') = coalesce(btrim(p_options->>'shoe_size'), '')
        )
    AND (
          coalesce(btrim(row.value->>'color'), '') = ''
          OR coalesce(btrim(row.value->>'color'), '') = coalesce(btrim(p_options->>'color'), '')
        )
  LIMIT 1;

  IF v_row IS NULL THEN
    RETURN QUERY SELECT false, v_has_inventory, 0, false;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    true,
    v_has_inventory,
    CASE
      WHEN coalesce(v_row->>'stock','') ~ '^[0-9]+$'
      THEN greatest(0, (v_row->>'stock')::integer)
      ELSE 0
    END,
    coalesce(v_row->>'unlimited_stock','false') = 'true';
END;
$function$;

CREATE OR REPLACE FUNCTION private.variant_inventory_state(p_variants jsonb)
RETURNS TABLE(
  stock integer,
  unlimited boolean,
  has_inventory boolean
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  SELECT
    coalesce(sum(
      CASE
        WHEN coalesce(row.value->>'unlimited_stock','false') = 'true' THEN 0
        WHEN coalesce(row.value->>'stock','') ~ '^[0-9]+$'
          THEN greatest(0, (row.value->>'stock')::integer)
        ELSE 0
      END
    ),0)::integer AS stock,
    coalesce(bool_or(coalesce(row.value->>'unlimited_stock','false') = 'true'),false) AS unlimited,
    count(*) > 0 AS has_inventory
  FROM pg_catalog.jsonb_array_elements(
    CASE
      WHEN pg_catalog.jsonb_typeof(coalesce(p_variants,'[]'::jsonb)->0->'variant_inventory') = 'array'
      THEN coalesce(p_variants,'[]'::jsonb)->0->'variant_inventory'
      ELSE '[]'::jsonb
    END
  ) AS row(value);
$function$;

CREATE OR REPLACE FUNCTION private.adjust_variant_inventory(
  p_variants jsonb,
  p_options jsonb,
  p_delta integer
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $function$
  CASE
    WHEN pg_catalog.jsonb_typeof(coalesce(p_variants,'[]'::jsonb)) <> 'array'
      OR pg_catalog.jsonb_array_length(coalesce(p_variants,'[]'::jsonb)) = 0
      OR pg_catalog.jsonb_typeof(coalesce(p_variants,'[]'::jsonb)->0->'variant_inventory') <> 'array'
    THEN coalesce(p_variants,'[]'::jsonb)
    ELSE pg_catalog.jsonb_set(
      p_variants,
      '{0,variant_inventory}',
      (
        SELECT coalesce(
          pg_catalog.jsonb_agg(
            CASE
              WHEN
                (
                  coalesce(btrim(row.value->>'size'),'') = ''
                  OR coalesce(btrim(row.value->>'size'),'') = coalesce(btrim(p_options->>'size'),'')
                )
                AND (
                  coalesce(btrim(row.value->>'shoe_size'),'') = ''
                  OR coalesce(btrim(row.value->>'shoe_size'),'') = coalesce(btrim(p_options->>'shoe_size'),'')
                )
                AND (
                  coalesce(btrim(row.value->>'color'),'') = ''
                  OR coalesce(btrim(row.value->>'color'),'') = coalesce(btrim(p_options->>'color'),'')
                )
              THEN pg_catalog.jsonb_set(
                row.value,
                '{stock}',
                to_jsonb(
                  greatest(
                    0,
                    CASE
                      WHEN coalesce(row.value->>'stock','') ~ '^[0-9]+$'
                      THEN (row.value->>'stock')::integer
                      ELSE 0
                    END + p_delta
                  )
                ),
                true
              )
              ELSE row.value
            END
            ORDER BY ordinality
          ),
          '[]'::jsonb
        )
        FROM pg_catalog.jsonb_array_elements(
          coalesce(p_variants,'[]'::jsonb)->0->'variant_inventory'
        ) WITH ORDINALITY AS row(value,ordinality)
      ),
      true
    )
  END;
$function$;

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
  v_coupon public.coupons%rowtype;
  v_found boolean;
  v_has_inventory boolean;
  v_variant_stock integer;
  v_variant_unlimited boolean;
  v_global_unlimited boolean;
  v_new_variants jsonb;
  v_global_stock integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_store_id IS NULL THEN RAISE EXCEPTION 'Store is required'; END IF;
  IF p_address_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.delivery_addresses
    WHERE id = p_address_id AND user_id = v_user
  ) THEN RAISE EXCEPTION 'Invalid delivery address'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;
  IF lower(coalesce(p_payment_method, 'cash')) NOT IN ('cash','wallet') THEN
    RAISE EXCEPTION 'Unsupported payment method';
  END IF;

  SELECT coalesce(default_delivery_fee_iqd, 1000),
         coalesce(platform_fee_iqd, 250)
  INTO v_delivery_fee, v_platform_fee
  FROM public.platform_settings
  WHERE id = true;

  FOR v_item IN
    SELECT product_id, coalesce(options, '{}'::jsonb) AS options, sum(quantity)::integer AS quantity
    FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity integer, options jsonb)
    GROUP BY product_id, coalesce(options, '{}'::jsonb)
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity <= 0 THEN RAISE EXCEPTION 'Invalid cart item'; END IF;
    IF jsonb_typeof(v_item.options) <> 'object' THEN RAISE EXCEPTION 'Invalid product options'; END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
    IF v_product.store_id <> p_store_id THEN RAISE EXCEPTION 'All products must belong to the same store'; END IF;
    IF NOT coalesce(v_product.is_available,false) THEN RAISE EXCEPTION 'Product is not available: %', v_product.name_ku; END IF;

    SELECT found,has_inventory,stock,unlimited
    INTO v_found,v_has_inventory,v_variant_stock,v_variant_unlimited
    FROM private.resolve_variant_inventory(v_product.variants,v_item.options);

    IF v_has_inventory THEN
      IF NOT v_found THEN RAISE EXCEPTION 'Selected product variant is not available: %', v_product.name_ku; END IF;
      IF NOT v_variant_unlimited AND v_variant_stock < v_item.quantity THEN
        RAISE EXCEPTION 'Insufficient stock for selected variant of %', v_product.name_ku;
      END IF;
    ELSE
      SELECT coalesce(bool_or(coalesce(value->>'unlimited_stock','false')='true'),false)
      INTO v_global_unlimited
      FROM pg_catalog.jsonb_array_elements(coalesce(v_product.variants,'[]'::jsonb)) AS v(value);

      IF NOT v_global_unlimited AND coalesce(v_product.stock,0) < v_item.quantity THEN
        RAISE EXCEPTION 'Insufficient stock for product %', v_product.name_ku;
      END IF;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(coalesce(v_product.variants,'[]'::jsonb)) AS v(value)
      WHERE pg_catalog.jsonb_typeof(v.value->'shoe_sizes')='array'
        AND pg_catalog.jsonb_array_length(v.value->'shoe_sizes')>0
    ) THEN
      IF coalesce(v_item.options->>'shoe_size','')='' THEN
        RAISE EXCEPTION 'Shoe size is required for product %', v_product.name_ku;
      END IF;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(coalesce(v_product.variants,'[]'::jsonb)) AS v(value)
      WHERE pg_catalog.jsonb_typeof(v.value->'available_sizes')='array'
        AND pg_catalog.jsonb_array_length(v.value->'available_sizes')>0
    ) THEN
      IF coalesce(v_item.options->>'size','')='' THEN
        RAISE EXCEPTION 'Size is required for product %', v_product.name_ku;
      END IF;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_array_elements(coalesce(v_product.variants,'[]'::jsonb)) AS v(value)
      WHERE pg_catalog.jsonb_typeof(v.value->'available_colors')='array'
        AND pg_catalog.jsonb_array_length(v.value->'available_colors')>0
    ) THEN
      IF coalesce(v_item.options->>'color','')='' THEN
        RAISE EXCEPTION 'Color is required for product %', v_product.name_ku;
      END IF;
    END IF;

    v_subtotal := v_subtotal + coalesce(v_product.sale_price_iqd,v_product.price_iqd) * v_item.quantity;
  END LOOP;

  IF btrim(coalesce(p_coupon_code,'')) <> '' THEN
    SELECT * INTO v_coupon
    FROM public.coupons
    WHERE lower(btrim(code))=lower(btrim(p_coupon_code))
    FOR UPDATE;

    IF NOT FOUND OR NOT coalesce(v_coupon.is_active,false) THEN RAISE EXCEPTION 'INVALID_COUPON'; END IF;
    IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at<=now() THEN RAISE EXCEPTION 'COUPON_EXPIRED'; END IF;
    IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count>=v_coupon.max_uses THEN RAISE EXCEPTION 'COUPON_LIMIT_REACHED'; END IF;

    IF v_coupon.discount_type='percent' THEN v_discount:=round(v_subtotal*v_coupon.discount_value/100.0,2);
    ELSE v_discount:=v_coupon.discount_value;
    END IF;
    v_discount:=least(greatest(0,v_discount),v_subtotal);
  END IF;

  v_total:=greatest(0,v_subtotal+v_delivery_fee+v_platform_fee-v_discount);

  INSERT INTO public.orders(
    customer_id,store_id,status,address_id,subtotal_iqd,delivery_fee_iqd,platform_fee_iqd,discount_iqd,total_iqd,
    payment_status,payment_method,coupon_id
  )
  VALUES(
    v_user,p_store_id,'pending'::public.order_status,p_address_id,v_subtotal,v_delivery_fee,v_platform_fee,v_discount,v_total,
    CASE WHEN lower(coalesce(p_payment_method,'cash'))='wallet' THEN 'paid'::public.payment_status ELSE 'pending'::public.payment_status END,
    lower(coalesce(p_payment_method,'cash')),v_coupon.id
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN
    SELECT product_id,coalesce(options,'{}'::jsonb) AS options,sum(quantity)::integer AS quantity
    FROM jsonb_to_recordset(p_items) AS x(product_id uuid,quantity integer,options jsonb)
    GROUP BY product_id,coalesce(options,'{}'::jsonb)
  LOOP
    SELECT * INTO v_product FROM public.products WHERE id=v_item.product_id FOR UPDATE;

    INSERT INTO public.order_items(order_id,product_id,product_name,quantity,unit_price_iqd,options)
    VALUES(v_order_id,v_product.id,v_product.name_ku,v_item.quantity,coalesce(v_product.sale_price_iqd,v_product.price_iqd),v_item.options);

    SELECT found,has_inventory,stock,unlimited
    INTO v_found,v_has_inventory,v_variant_stock,v_variant_unlimited
    FROM private.resolve_variant_inventory(v_product.variants,v_item.options);

    IF v_has_inventory AND v_found THEN
      IF NOT v_variant_unlimited THEN
        SELECT private.adjust_variant_inventory(v_product.variants,v_item.options,-v_item.quantity)
        INTO v_new_variants;
        SELECT stock,unlimited INTO v_global_stock,v_global_unlimited
        FROM private.variant_inventory_state(v_new_variants);

        UPDATE public.products
        SET variants=v_new_variants,
            stock=v_global_stock,
            is_available=(v_global_unlimited OR v_global_stock>0),
            updated_at=now()
        WHERE id=v_product.id;
      END IF;
    ELSIF NOT v_has_inventory THEN
      SELECT coalesce(bool_or(coalesce(value->>'unlimited_stock','false')='true'),false)
      INTO v_global_unlimited
      FROM pg_catalog.jsonb_array_elements(coalesce(v_product.variants,'[]'::jsonb)) AS v(value);

      IF NOT v_global_unlimited THEN
        UPDATE public.products
        SET stock=greatest(0,coalesce(stock,0)-v_item.quantity),
            is_available=CASE WHEN coalesce(stock,0)-v_item.quantity<=0 THEN false ELSE is_available END,
            updated_at=now()
        WHERE id=v_product.id;
      END IF;
    END IF;
  END LOOP;

  IF v_coupon.id IS NOT NULL THEN
    UPDATE public.coupons SET used_count=used_count+1 WHERE id=v_coupon.id;
  END IF;

  IF lower(coalesce(p_payment_method,'cash'))='wallet' THEN
    INSERT INTO public.wallets(user_id) VALUES(v_user) ON CONFLICT(user_id) DO NOTHING;
    SELECT balance_iqd INTO v_wallet_balance FROM public.wallets WHERE user_id=v_user FOR UPDATE;
    IF coalesce(v_wallet_balance,0)<v_total THEN RAISE EXCEPTION 'INSUFFICIENT_WALLET_BALANCE'; END IF;

    INSERT INTO public.wallet_transactions(wallet_id,type,amount_iqd,reference_id,description)
    SELECT w.id,'debit'::public.wallet_tx_type,v_total,v_order_id,'پارەدانی Wallet بۆ ئۆردەر #'||left(v_order_id::text,8)
    FROM public.wallets w WHERE w.user_id=v_user;

    UPDATE public.wallets SET balance_iqd=balance_iqd-v_total,updated_at=now() WHERE user_id=v_user;
  END IF;

  RETURN v_order_id;
END;
$function$;

CREATE OR REPLACE FUNCTION private.create_order_with_stock(
  p_store_id uuid,p_address_id uuid,p_items jsonb,p_payment_method text
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path=''
AS $function$
  SELECT private.create_order_with_stock(p_store_id,p_address_id,p_items,p_payment_method,NULL);
$function$;

CREATE OR REPLACE FUNCTION private.create_order_with_stock(
  p_store_id uuid,p_address_id uuid,p_items jsonb
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path=''
AS $function$
  SELECT private.create_order_with_stock(p_store_id,p_address_id,p_items,'cash',NULL);
$function$;

CREATE OR REPLACE FUNCTION private.transition_order_status(
  p_order_id uuid,
  p_next_status public.order_status
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  v_order public.orders;
  v_role public.app_role;
  v_current public.order_status;
  v_allowed boolean:=false;
  v_product public.products%rowtype;
  v_item record;
  v_found boolean;
  v_has_inventory boolean;
  v_variant_stock integer;
  v_variant_unlimited boolean;
  v_global_unlimited boolean;
  v_new_variants jsonb;
  v_global_stock integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;

  SELECT role INTO v_role
  FROM public.user_roles
  WHERE user_id=auth.uid() AND is_active=true
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_role IS NULL THEN SELECT role INTO v_role FROM public.profiles WHERE id=auth.uid(); END IF;

  SELECT * INTO v_order FROM public.orders WHERE id=p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;

  v_current:=v_order.status;

  IF v_role IN ('super_admin','admin') THEN
    v_allowed:=true;
  ELSIF v_role='customer' THEN
    v_allowed:=v_order.customer_id=auth.uid() AND v_current='pending' AND p_next_status='cancelled';
  ELSIF v_role IN ('restaurant_vendor','supermarket_vendor','fashion_vendor','vendor','electronics_vendor','jewelry_vendor') THEN
    v_allowed:=EXISTS(
      SELECT 1 FROM public.stores s
      WHERE s.id=v_order.store_id AND s.owner_id=auth.uid()
    ) AND (
      (v_current='pending' AND p_next_status='accepted') OR
      (v_current='accepted' AND p_next_status='preparing') OR
      (v_current='preparing' AND p_next_status='ready_for_pickup')
    );
  ELSIF v_role='captain' THEN
    v_allowed:=v_order.captain_id=auth.uid() AND (
      (v_current='assigned_to_captain' AND p_next_status='picked_up') OR
      (v_current='picked_up' AND p_next_status='on_the_way') OR
      (v_current='on_the_way' AND p_next_status='delivered')
    );
  END IF;

  IF NOT v_allowed THEN RAISE EXCEPTION 'status_transition_not_allowed'; END IF;

  IF v_current='pending' AND p_next_status='cancelled' THEN
    FOR v_item IN
      SELECT product_id,coalesce(options,'{}'::jsonb) AS options,quantity
      FROM public.order_items
      WHERE order_id=v_order.id
    LOOP
      SELECT * INTO v_product
      FROM public.products
      WHERE id=v_item.product_id
      FOR UPDATE;

      IF NOT FOUND THEN CONTINUE; END IF;

      SELECT found,has_inventory,stock,unlimited
      INTO v_found,v_has_inventory,v_variant_stock,v_variant_unlimited
      FROM private.resolve_variant_inventory(v_product.variants,v_item.options);

      IF v_has_inventory AND v_found THEN
        IF NOT v_variant_unlimited THEN
          SELECT private.adjust_variant_inventory(v_product.variants,v_item.options,v_item.quantity)
          INTO v_new_variants;
          SELECT stock,unlimited INTO v_global_stock,v_global_unlimited
          FROM private.variant_inventory_state(v_new_variants);

          UPDATE public.products
          SET variants=v_new_variants,
              stock=v_global_stock,
              is_available=(v_global_unlimited OR v_global_stock>0),
              updated_at=now()
          WHERE id=v_product.id;
        END IF;
      ELSIF NOT v_has_inventory THEN
        SELECT coalesce(bool_or(coalesce(value->>'unlimited_stock','false')='true'),false)
        INTO v_global_unlimited
        FROM pg_catalog.jsonb_array_elements(coalesce(v_product.variants,'[]'::jsonb)) AS v(value);

        IF NOT v_global_unlimited THEN
          UPDATE public.products
          SET stock=coalesce(stock,0)+v_item.quantity,
              is_available=true,
              updated_at=now()
          WHERE id=v_product.id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.orders
  SET status=p_next_status,
      updated_at=now(),
      delivered_at=CASE
        WHEN p_next_status='delivered' AND v_order.delivered_at IS NULL THEN now()
        WHEN v_order.delivered_at IS NOT NULL THEN v_order.delivered_at
        ELSE NULL
      END
  WHERE id=p_order_id
  RETURNING * INTO v_order;

  IF p_next_status IN ('delivered','cancelled') THEN
    DELETE FROM public.delivery_tracking_locations
    WHERE order_id=p_order_id;
  END IF;

  RETURN v_order;
END;
$function$;

REVOKE ALL ON FUNCTION private.resolve_variant_inventory(jsonb,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.variant_inventory_state(jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.adjust_variant_inventory(jsonb,jsonb,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.transition_order_status(uuid,public.order_status) FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION private.transition_order_status(uuid,public.order_status) TO authenticated;

COMMIT;
