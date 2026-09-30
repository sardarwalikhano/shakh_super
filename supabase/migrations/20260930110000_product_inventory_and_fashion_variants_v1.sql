-- SHAKH: product inventory modes + clothing/shoe variant validation.
-- Preserves the existing product stock column for backward compatibility.
-- unlimited_stock=true means stock is not decremented or capped at checkout.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unlimited_stock boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_unlimited_stock
  ON public.products (unlimited_stock);

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
  v_option text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'Store is required';
  END IF;
  IF p_address_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.delivery_addresses
    WHERE id = p_address_id AND user_id = v_user
  ) THEN
    RAISE EXCEPTION 'Invalid delivery address';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;
  IF lower(coalesce(p_payment_method, 'cash')) NOT IN ('cash', 'wallet') THEN
    RAISE EXCEPTION 'Unsupported payment method';
  END IF;

  SELECT coalesce(default_delivery_fee_iqd, 1000),
         coalesce(platform_fee_iqd, 250)
  INTO v_delivery_fee, v_platform_fee
  FROM public.platform_settings
  WHERE id = true;

  FOR v_item IN
    SELECT product_id,
           coalesce(options, '{}'::jsonb) AS options,
           sum(quantity)::integer AS quantity
    FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity integer, options jsonb)
    GROUP BY product_id, coalesce(options, '{}'::jsonb)
  LOOP
    IF v_item.product_id IS NULL OR v_item.quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid cart item';
    END IF;
    IF jsonb_typeof(v_item.options) <> 'object' THEN
      RAISE EXCEPTION 'Invalid product options';
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

    -- Shoe sizes are required and must match the currently published list.
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) AS variant
      WHERE jsonb_typeof(variant->'shoe_sizes') = 'array'
        AND jsonb_array_length(variant->'shoe_sizes') > 0
    ) THEN
      IF coalesce(v_item.options->>'shoe_size', '') = '' THEN
        RAISE EXCEPTION 'Shoe size is required for product %', v_product.name_ku;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) AS variant
        WHERE jsonb_typeof(variant->'shoe_sizes') = 'array'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(variant->'shoe_sizes') AS size_value
            WHERE size_value = v_item.options->>'shoe_size'
          )
      ) THEN
        RAISE EXCEPTION 'Selected shoe size % is not available for product %',
          v_item.options->>'shoe_size', v_product.name_ku;
      END IF;
    END IF;

    -- Clothing sizes are required and must match the published list.
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) AS variant
      WHERE jsonb_typeof(coalesce(variant->'available_sizes', variant->'sizes')) = 'array'
        AND jsonb_array_length(coalesce(variant->'available_sizes', variant->'sizes')) > 0
    ) THEN
      IF coalesce(v_item.options->>'size', '') = '' THEN
        RAISE EXCEPTION 'Size is required for product %', v_product.name_ku;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) AS variant
        WHERE jsonb_typeof(coalesce(variant->'available_sizes', variant->'sizes')) = 'array'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(coalesce(variant->'available_sizes', variant->'sizes')) AS size_value
            WHERE size_value = v_item.options->>'size'
          )
      ) THEN
        RAISE EXCEPTION 'Selected size % is not available for product %',
          v_item.options->>'size', v_product.name_ku;
      END IF;
    END IF;

    -- Colors are required and must match the published list.
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) AS variant
      WHERE jsonb_typeof(coalesce(variant->'available_colors', variant->'colors')) = 'array'
        AND jsonb_array_length(coalesce(variant->'available_colors', variant->'colors')) > 0
    ) THEN
      IF coalesce(v_item.options->>'color', '') = '' THEN
        RAISE EXCEPTION 'Color is required for product %', v_product.name_ku;
      END IF;

      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) AS variant
        WHERE jsonb_typeof(coalesce(variant->'available_colors', variant->'colors')) = 'array'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(coalesce(variant->'available_colors', variant->'colors')) AS color_value
            WHERE color_value = v_item.options->>'color'
          )
      ) THEN
        RAISE EXCEPTION 'Selected color % is not available for product %',
          v_item.options->>'color', v_product.name_ku;
      END IF;
    END IF;

    IF NOT coalesce(v_product.is_available, false) THEN
      RAISE EXCEPTION 'Product is not available: %', v_product.name_ku;
    END IF;

    IF NOT coalesce(v_product.unlimited_stock, false)
       AND coalesce(v_product.stock, 0) < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_product.name_ku;
    END IF;

    v_subtotal := v_subtotal
      + coalesce(v_product.sale_price_iqd, v_product.price_iqd)
      * v_item.quantity;
  END LOOP;

  IF btrim(coalesce(p_coupon_code, '')) <> '' THEN
    SELECT * INTO v_coupon
    FROM public.coupons
    WHERE lower(btrim(code)) = lower(btrim(p_coupon_code))
    FOR UPDATE;

    IF NOT FOUND OR NOT coalesce(v_coupon.is_active, false) THEN
      RAISE EXCEPTION 'INVALID_COUPON';
    END IF;
    IF v_coupon.expires_at IS NOT NULL AND v_coupon.expires_at <= now() THEN
      RAISE EXCEPTION 'COUPON_EXPIRED';
    END IF;
    IF v_coupon.max_uses IS NOT NULL AND v_coupon.used_count >= v_coupon.max_uses THEN
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

  INSERT INTO public.orders (
    customer_id, store_id, status, address_id,
    subtotal_iqd, delivery_fee_iqd, platform_fee_iqd, discount_iqd, total_iqd,
    payment_status, payment_method, coupon_id
  )
  VALUES (
    v_user, p_store_id, 'pending'::public.order_status, p_address_id,
    v_subtotal, v_delivery_fee, v_platform_fee, v_discount, v_total,
    CASE
      WHEN lower(coalesce(p_payment_method, 'cash')) = 'wallet'
      THEN 'paid'::public.payment_status
      ELSE 'pending'::public.payment_status
    END,
    lower(coalesce(p_payment_method, 'cash')),
    v_coupon.id
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN
    SELECT product_id,
           coalesce(options, '{}'::jsonb) AS options,
           sum(quantity)::integer AS quantity
    FROM jsonb_to_recordset(p_items) AS x(product_id uuid, quantity integer, options jsonb)
    GROUP BY product_id, coalesce(options, '{}'::jsonb)
  LOOP
    SELECT *
    INTO v_product
    FROM public.products
    WHERE id = v_item.product_id
    FOR UPDATE;

    INSERT INTO public.order_items (
      order_id, product_id, product_name, quantity, unit_price_iqd, options
    )
    VALUES (
      v_order_id,
      v_product.id,
      v_product.name_ku,
      v_item.quantity,
      coalesce(v_product.sale_price_iqd, v_product.price_iqd),
      v_item.options
    );

    IF NOT coalesce(v_product.unlimited_stock, false) THEN
      UPDATE public.products
      SET stock = greatest(0, coalesce(stock, 0) - v_item.quantity),
          is_available = CASE
            WHEN coalesce(stock, 0) - v_item.quantity <= 0 THEN false
            ELSE is_available
          END,
          updated_at = now()
      WHERE id = v_product.id;
    END IF;
  END LOOP;

  IF v_coupon.id IS NOT NULL THEN
    UPDATE public.coupons
    SET used_count = used_count + 1
    WHERE id = v_coupon.id;
  END IF;

  IF lower(coalesce(p_payment_method, 'cash')) = 'wallet' THEN
    INSERT INTO public.wallets(user_id)
    VALUES(v_user)
    ON CONFLICT(user_id) DO NOTHING;

    SELECT balance_iqd
    INTO v_wallet_balance
    FROM public.wallets
    WHERE user_id = v_user
    FOR UPDATE;

    IF coalesce(v_wallet_balance, 0) < v_total THEN
      RAISE EXCEPTION 'INSUFFICIENT_WALLET_BALANCE';
    END IF;

    INSERT INTO public.wallet_transactions(
      wallet_id, type, amount_iqd, reference_id, description
    )
    SELECT w.id,
           'debit'::public.wallet_tx_type,
           v_total,
           v_order_id,
           'پارەدانی Wallet بۆ ئۆردەر #' || left(v_order_id::text,8)
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
AS $function$
  SELECT private.create_order_with_stock(
    p_store_id, p_address_id, p_items, p_payment_method, NULL
  );
$function$;

CREATE OR REPLACE FUNCTION private.create_order_with_stock(
  p_store_id uuid,
  p_address_id uuid,
  p_items jsonb
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT private.create_order_with_stock(
    p_store_id, p_address_id, p_items, 'cash', NULL
  );
$function$;

CREATE OR REPLACE FUNCTION private.transition_order_status(
  p_order_id uuid,
  p_next_status public.order_status
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  v_order public.orders;
  v_role public.app_role;
  v_current public.order_status;
  v_allowed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select role into v_role
  from public.user_roles
  where user_id = auth.uid()
    and is_active = true
  order by created_at desc
  limit 1;

  if v_role is null then
    select role into v_role
    from public.profiles
    where id = auth.uid();
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'order_not_found';
  end if;

  v_current := v_order.status;

  if v_role in ('super_admin','admin') then
    v_allowed := true;
  elsif v_role = 'customer' then
    v_allowed := v_order.customer_id = auth.uid()
      and v_current = 'pending'
      and p_next_status = 'cancelled';
  elsif v_role in (
    'restaurant_vendor','supermarket_vendor','fashion_vendor','vendor',
    'electronics_vendor','jewelry_vendor'
  ) then
    v_allowed := exists (
      select 1
      from public.stores s
      where s.id = v_order.store_id
        and s.owner_id = auth.uid()
    ) and (
      (v_current = 'pending' and p_next_status = 'accepted') or
      (v_current = 'accepted' and p_next_status = 'preparing') or
      (v_current = 'preparing' and p_next_status = 'ready_for_pickup')
    );
  elsif v_role = 'captain' then
    v_allowed := v_order.captain_id = auth.uid() and (
      (v_current = 'assigned_to_captain' and p_next_status = 'picked_up') or
      (v_current = 'picked_up' and p_next_status = 'on_the_way') or
      (v_current = 'on_the_way' and p_next_status = 'delivered')
    );
  end if;

  if not v_allowed then
    raise exception 'status_transition_not_allowed';
  end if;

  if v_current = 'pending'
     and p_next_status = 'cancelled' then
    update public.products p
    set stock = coalesce(p.stock, 0) + oi.quantity,
        is_available = case
          when coalesce(p.stock, 0) + oi.quantity > 0 then true
          else p.is_available
        end,
        updated_at = now()
    from public.order_items oi
    where oi.order_id = v_order.id
      and oi.product_id = p.id
      and not coalesce(p.unlimited_stock, false);
  end if;

  update public.orders
  set status = p_next_status,
      updated_at = now(),
      delivered_at = case
        when p_next_status = 'delivered' and v_order.delivered_at is null then now()
        when v_order.delivered_at is not null then v_order.delivered_at
        else null
      end
  where id = p_order_id
  returning * into v_order;

  if p_next_status in ('delivered','cancelled') then
    delete from public.delivery_tracking_locations
    where order_id = p_order_id;
  end if;

  return v_order;
end;
$function$;

REVOKE ALL ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb) TO authenticated;
