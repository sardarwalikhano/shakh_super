-- Reviews: keep ratings within the supported range and make delivered-order reviews unique per customer.
alter table public.reviews
  add constraint reviews_rating_range_check
  check (rating between 1 and 5);

create unique index if not exists reviews_one_per_user_order
  on public.reviews (user_id, order_id)
  where order_id is not null;

drop policy if exists reviews_self on public.reviews;

create policy reviews_self
on public.reviews
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (
    order_id is null
    or exists (
      select 1
      from public.orders o
      where o.id = reviews.order_id
        and o.customer_id = (select auth.uid())
        and o.status = 'delivered'
    )
  )
);
