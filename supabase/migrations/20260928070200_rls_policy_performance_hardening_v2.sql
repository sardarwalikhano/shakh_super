-- SHAKH: RLS initplan and duplicate-index hardening v2
-- Backward-compatible: access semantics are unchanged; only auth-function
-- evaluation is optimized and one proven duplicate index is removed.

begin;

alter policy captain_self on public.captains
  using ((user_id = (select auth.uid())) or (select is_admin()))
  with check ((user_id = (select auth.uid())) or (select is_admin()));

alter policy cart_items_self on public.cart_items
  using (exists (
    select 1 from public.carts c
    where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.carts c
    where c.id = cart_items.cart_id and c.user_id = (select auth.uid())
  ));

alter policy cart_self on public.carts
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy address_self on public.delivery_addresses
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy order_items_insert on public.order_items
  with check (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id and o.customer_id = (select auth.uid())
  ));

alter policy order_items_relevant on public.order_items
  using (exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and (
        o.customer_id = (select auth.uid())
        or o.captain_id = (select auth.uid())
        or (select is_admin())
        or exists (
          select 1 from public.stores s
          where s.id = o.store_id and s.owner_id = (select auth.uid())
        )
      )
  ));

alter policy history_relevant on public.order_status_history
  using (exists (
    select 1 from public.orders o
    where o.id = order_status_history.order_id
      and (
        o.customer_id = (select auth.uid())
        or o.captain_id = (select auth.uid())
        or (select is_admin())
        or exists (
          select 1 from public.stores s
          where s.id = o.store_id and s.owner_id = (select auth.uid())
        )
      )
  ));

alter policy users_read_own_order_history on public.order_status_history
  using (exists (
    select 1 from public.orders o
    where o.id = order_status_history.order_id
      and o.customer_id = (select auth.uid())
  ));

alter policy orders_insert on public.orders
  with check (customer_id = (select auth.uid()));

alter policy orders_relevant on public.orders
  using (
    customer_id = (select auth.uid())
    or captain_id = (select auth.uid())
    or (select is_admin())
    or exists (
      select 1 from public.stores s
      where s.id = orders.store_id and s.owner_id = (select auth.uid())
    )
  );

alter policy orders_update_delivery on public.orders
  using ((captain_id = (select auth.uid())) or (select is_admin()))
  with check ((captain_id = (select auth.uid())) or (select is_admin()));

alter policy orders_update_vendor on public.orders
  using (exists (
    select 1 from public.stores s
    where s.id = orders.store_id and s.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.stores s
    where s.id = orders.store_id and s.owner_id = (select auth.uid())
  ));

alter policy promotions_owner on public.promotions
  using ((select is_admin()) or exists (
    select 1 from public.stores s
    where s.id = promotions.store_id and s.owner_id = (select auth.uid())
  ))
  with check ((select is_admin()) or exists (
    select 1 from public.stores s
    where s.id = promotions.store_id and s.owner_id = (select auth.uid())
  ));

alter policy reviews_owner on public.reviews
  using ((user_id = (select auth.uid())) or (select is_admin()));

alter policy reviews_self on public.reviews
  with check (user_id = (select auth.uid()));

alter policy support_self on public.support_tickets
  using ((user_id = (select auth.uid())) or (select is_admin()))
  with check ((user_id = (select auth.uid())) or (select is_admin()));

alter policy roles_self_admin on public.user_roles
  using ((user_id = (select auth.uid())) or (select is_admin()));

alter policy wallet_tx_self on public.wallet_transactions
  using (exists (
    select 1 from public.wallets w
    where w.id = wallet_transactions.wallet_id
      and ((w.user_id = (select auth.uid())) or (select is_admin()))
  ));

alter policy wallet_self on public.wallets
  using ((user_id = (select auth.uid())) or (select is_admin()));

drop index if exists public.idx_notifications_user;

commit;
