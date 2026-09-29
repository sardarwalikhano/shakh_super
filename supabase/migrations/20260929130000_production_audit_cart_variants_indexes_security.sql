-- Production audit fixes: cart variants, FK indexes, function search path
alter table public.cart_items
  drop constraint if exists cart_items_cart_id_product_id_key;

create unique index if not exists cart_items_cart_product_options_key
  on public.cart_items (cart_id, product_id, options);

create index if not exists idx_audit_logs_actor_id on public.audit_logs(actor_id);
create index if not exists idx_cart_items_product_id on public.cart_items(product_id);
create index if not exists idx_carts_store_id on public.carts(store_id);
create index if not exists idx_delivery_addresses_user_id on public.delivery_addresses(user_id);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_product_id on public.order_items(product_id);
create index if not exists idx_order_status_history_changed_by on public.order_status_history(changed_by);
create index if not exists idx_orders_address_id on public.orders(address_id);
create index if not exists idx_orders_captain_id on public.orders(captain_id);
create index if not exists idx_promotions_store_id on public.promotions(store_id);
create index if not exists idx_reviews_order_id on public.reviews(order_id);
create index if not exists idx_reviews_product_id on public.reviews(product_id);
create index if not exists idx_reviews_store_id on public.reviews(store_id);
create index if not exists idx_stores_owner_id on public.stores(owner_id);
create index if not exists idx_support_tickets_user_id on public.support_tickets(user_id);
create index if not exists idx_umrah_agencies_approved_by on public.umrah_agencies(approved_by);
create index if not exists idx_umrah_agencies_owner_id on public.umrah_agencies(owner_id);
create index if not exists idx_umrah_bookings_trip_id on public.umrah_bookings(trip_id);
create index if not exists idx_umrah_company_settlements_booking_id on public.umrah_company_settlements(booking_id);
create index if not exists idx_umrah_company_settlements_verified_by on public.umrah_company_settlements(verified_by);
create index if not exists idx_umrah_payment_records_agency_id on public.umrah_payment_records(agency_id);
create index if not exists idx_umrah_payment_records_verified_by on public.umrah_payment_records(verified_by);
create index if not exists idx_umrah_posting_payments_payer_id on public.umrah_posting_payments(payer_id);
create index if not exists idx_umrah_posting_payments_verified_by on public.umrah_posting_payments(verified_by);
create index if not exists idx_umrah_trips_approved_by on public.umrah_trips(approved_by);
create index if not exists idx_vehicle_listings_approved_by on public.vehicle_listings(approved_by);
create index if not exists idx_vehicle_posting_payments_payer_id on public.vehicle_posting_payments(payer_id);
create index if not exists idx_vehicle_posting_payments_showroom_id on public.vehicle_posting_payments(showroom_id);
create index if not exists idx_vehicle_posting_payments_verified_by on public.vehicle_posting_payments(verified_by);
create index if not exists idx_vehicle_showrooms_approved_by on public.vehicle_showrooms(approved_by);
create index if not exists idx_vehicle_showrooms_owner_id on public.vehicle_showrooms(owner_id);
create index if not exists idx_wallet_transactions_wallet_id on public.wallet_transactions(wallet_id);

alter function public.delivery_zone_contains_point(jsonb,double precision,double precision)
  set search_path = pg_catalog, public;

revoke all on function public.address_within_delivery_zone(uuid,uuid) from public, anon, authenticated;
grant execute on function public.address_within_delivery_zone(uuid,uuid) to service_role;

revoke all on function public.validate_order_delivery_zone() from public, anon, authenticated;