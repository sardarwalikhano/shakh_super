-- Harden the order lifecycle without removing any existing workflow.
-- Pending-order cancellation restores reserved stock regardless of whether the
-- transition was initiated by the customer or an authorized admin.
-- Terminal orders no longer retain live captain GPS data.

create or replace function public.transition_order_status(
  p_order_id uuid,
  p_next_status public.order_status
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
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
    'restaurant_vendor',
    'supermarket_vendor',
    'fashion_vendor',
    'vendor',
    'electronics_vendor',
    'jewelry_vendor'
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
      and oi.product_id = p.id;
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

  if p_next_status in ('delivered', 'cancelled') then
    delete from public.delivery_tracking_locations
    where order_id = p_order_id;
  end if;

  return v_order;
end;
$function$;

revoke execute on function public.transition_order_status(uuid, public.order_status) from public;
revoke execute on function public.transition_order_status(uuid, public.order_status) from anon;
grant execute on function public.transition_order_status(uuid, public.order_status) to authenticated;