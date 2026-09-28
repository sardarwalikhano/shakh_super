-- Preserve selected product variants from cart through checkout.
-- Shoe products with variants.shoe_sizes require a selected shoe_size.
CREATE OR REPLACE FUNCTION public.create_order_with_stock(p_store_id uuid, p_address_id uuid, p_items jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_order_id uuid;
  v_item record;
  v_product public.products%rowtype;
  v_subtotal numeric := 0;
  v_delivery_fee numeric := 1000;
  v_platform_fee numeric := 250;
  v_total numeric;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if p_store_id is null then
    raise exception 'Store is required';
  end if;

  if p_address_id is null
     or not exists (
       select 1 from public.delivery_addresses
       where id = p_address_id and user_id = v_user
     ) then
    raise exception 'Invalid delivery address';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;

  for v_item in
    select product_id,
           coalesce(options, '{}'::jsonb) as options,
           sum(quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, options jsonb)
    group by product_id, coalesce(options, '{}'::jsonb)
  loop
    if v_item.product_id is null or v_item.quantity <= 0 then
      raise exception 'Invalid cart item';
    end if;

    if jsonb_typeof(v_item.options) <> 'object' then
      raise exception 'Invalid product options';
    end if;

    select * into v_product
    from public.products
    where id = v_item.product_id
    for update;

    if not found then
      raise exception 'Product not found';
    end if;

    if v_product.store_id <> p_store_id then
      raise exception 'All products must belong to the same store';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) as variant
      where jsonb_typeof(variant->'shoe_sizes') = 'array'
        and jsonb_array_length(variant->'shoe_sizes') > 0
    ) then
      if coalesce(v_item.options->>'shoe_size', '') = '' then
        raise exception 'Shoe size is required for product %', v_product.name_ku;
      end if;

      if not exists (
        select 1
        from jsonb_array_elements(coalesce(v_product.variants, '[]'::jsonb)) as variant
        where (
          jsonb_typeof(variant->'shoe_sizes') = 'array'
          and exists (
            select 1
            from jsonb_array_elements_text(variant->'shoe_sizes') as size_value
            where size_value = v_item.options->>'shoe_size'
          )
        )
        or variant->>'shoe_size' = v_item.options->>'shoe_size'
      ) then
        raise exception 'Selected shoe size % is not available for product %',
          v_item.options->>'shoe_size', v_product.name_ku;
      end if;
    end if;

    if not v_product.is_available
       or coalesce(v_product.stock, 0) < v_item.quantity then
      raise exception 'Insufficient stock for product %', v_product.name_ku;
    end if;

    v_subtotal := v_subtotal
      + coalesce(v_product.sale_price_iqd, v_product.price_iqd) * v_item.quantity;
  end loop;

  v_total := v_subtotal + v_delivery_fee + v_platform_fee;

  insert into public.orders (
    customer_id, store_id, status, address_id, subtotal_iqd,
    delivery_fee_iqd, platform_fee_iqd, discount_iqd, total_iqd,
    payment_status, payment_method
  )
  values (
    v_user, p_store_id, 'pending', p_address_id, v_subtotal,
    v_delivery_fee, v_platform_fee, 0, v_total, 'pending', 'cash'
  )
  returning id into v_order_id;

  for v_item in
    select product_id,
           coalesce(options, '{}'::jsonb) as options,
           sum(quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer, options jsonb)
    group by product_id, coalesce(options, '{}'::jsonb)
  loop
    select * into v_product
    from public.products
    where id = v_item.product_id
    for update;

    insert into public.order_items (
      order_id, product_id, product_name, quantity, unit_price_iqd, options
    )
    values (
      v_order_id, v_product.id, v_product.name_ku, v_item.quantity,
      coalesce(v_product.sale_price_iqd, v_product.price_iqd), v_item.options
    );

    update public.products
    set stock = greatest(0, coalesce(stock, 0) - v_item.quantity),
        is_available = case
          when coalesce(stock, 0) - v_item.quantity <= 0 then false
          else is_available
        end,
        updated_at = now()
    where id = v_product.id;
  end loop;

  return v_order_id;
end;
$function$;
