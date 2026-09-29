-- SHAKH Stage 14: Cars, Umrah, Support and Posts integrity hardening.
-- Re-run-safe against the current schema. No existing rows are altered.

-- Posts: authors may edit content/visibility/archive, but not moderation fields.
create or replace function public.protect_post_moderation_fields()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.status := old.status;
    new.rejection_reason := old.rejection_reason;
    if old.archived_at is not null then
      new.archived_at := old.archived_at;
    elsif new.archived_at is not null then
      new.archived_at := now();
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_protect_post_moderation_fields on public.posts;
create trigger trg_protect_post_moderation_fields
before update of status, rejection_reason, archived_at
on public.posts
for each row execute function public.protect_post_moderation_fields();

-- Cars: status contract used by the UI.
alter table public.vehicle_posting_payments
  drop constraint if exists vehicle_posting_payments_status_check;
alter table public.vehicle_posting_payments
  add constraint vehicle_posting_payments_status_check
  check (status = any (array[
    'pending','submitted','paid','failed','refunded','verified','rejected'
  ]::text[]));

create unique index if not exists vehicle_posting_payments_one_active_per_listing_idx
on public.vehicle_posting_payments(listing_id)
where status in ('pending','submitted','paid','verified');

create or replace function public.validate_vehicle_posting_payment_insert()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_owner uuid;
  v_showroom uuid;
  v_fee numeric;
begin
  if auth.uid() is null or new.payer_id <> auth.uid() then
    raise exception 'Invalid payment owner';
  end if;

  if new.status <> 'submitted' or new.payment_method <> 'cash' then
    raise exception 'Vehicle posting payment must be submitted cash payment';
  end if;

  if new.receipt_url is null
     or new.receipt_url not like (auth.uid()::text || '/vehicle-payments/%') then
    raise exception 'Invalid vehicle payment receipt path';
  end if;

  select l.owner_id, l.showroom_id, s.posting_fee_iqd
  into v_owner, v_showroom, v_fee
  from public.vehicle_listings l
  join public.vehicle_showrooms s on s.id = l.showroom_id
  where l.id = new.listing_id
  for update;

  if v_owner is null then
    raise exception 'Invalid vehicle listing';
  end if;

  if v_owner <> auth.uid() or new.showroom_id <> v_showroom then
    raise exception 'Vehicle payment ownership mismatch';
  end if;

  if coalesce(v_fee, 0) <= 0 or new.amount_iqd <> v_fee then
    raise exception 'Vehicle posting payment amount mismatch';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_validate_vehicle_posting_payment_insert
on public.vehicle_posting_payments;
create trigger trg_validate_vehicle_posting_payment_insert
before insert on public.vehicle_posting_payments
for each row execute function public.validate_vehicle_posting_payment_insert();

create or replace function public.protect_vehicle_listing_workflow()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.owner_id := auth.uid();
      new.commission_iqd := 0;
      new.status := 'pending_payment';
      new.approved_at := null;
      new.approved_by := null;
      new.rejection_reason := null;
    else
      new.owner_id := old.owner_id;
      new.showroom_id := old.showroom_id;
      new.commission_iqd := old.commission_iqd;
      new.approved_at := old.approved_at;
      new.approved_by := old.approved_by;
      new.rejection_reason := old.rejection_reason;

      if new.status is distinct from old.status then
        if not (
          (old.status = 'pending_payment' and new.status = 'pending_payment_verification')
          or (old.status = 'approved' and new.status in ('sold','archived'))
          or (old.status = 'sold' and new.status = 'archived')
        ) then
          new.status := old.status;
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_protect_vehicle_listing_workflow on public.vehicle_listings;
create trigger trg_protect_vehicle_listing_workflow
before insert or update on public.vehicle_listings
for each row execute function public.protect_vehicle_listing_workflow();

create or replace function public.protect_vehicle_showroom_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.posting_fee_iqd := 0;
      new.approved_at := null;
      new.approved_by := null;
    else
      new.owner_id := old.owner_id;
      new.posting_fee_iqd := old.posting_fee_iqd;
      new.is_active := old.is_active;
      new.approved_at := old.approved_at;
      new.approved_by := old.approved_by;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_protect_vehicle_showroom_admin_fields on public.vehicle_showrooms;
create trigger trg_protect_vehicle_showroom_admin_fields
before insert or update on public.vehicle_showrooms
for each row execute function public.protect_vehicle_showroom_admin_fields();

-- Umrah agency/trip workflow.
alter table public.umrah_agencies
  alter column is_active set default false;

create or replace function public.protect_umrah_agency_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.posting_fee_iqd := 0;
      new.is_active := false;
      new.approved_at := null;
      new.approved_by := null;
    else
      new.owner_id := old.owner_id;
      new.posting_fee_iqd := old.posting_fee_iqd;
      new.is_active := old.is_active;
      new.approved_at := old.approved_at;
      new.approved_by := old.approved_by;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_protect_umrah_agency_admin_fields on public.umrah_agencies;
create trigger trg_protect_umrah_agency_admin_fields
before insert or update on public.umrah_agencies
for each row execute function public.protect_umrah_agency_admin_fields();

alter table public.umrah_trips
  drop constraint if exists umrah_trips_status_check;
alter table public.umrah_trips
  add constraint umrah_trips_status_check
  check (status = any (array[
    'draft','pending_payment','pending_payment_verification',
    'pending_approval','approved','rejected','closed','cancelled'
  ]::text[]));

create or replace function public.protect_umrah_trip_workflow()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.booking_fee_iqd := 3000;
      new.status := 'pending_payment';
      new.approved_at := null;
      new.approved_by := null;
    else
      new.agency_id := old.agency_id;
      new.booking_fee_iqd := old.booking_fee_iqd;
      new.approved_at := old.approved_at;
      new.approved_by := old.approved_by;

      if new.status is distinct from old.status then
        if not (
          old.status = 'pending_payment'
          and new.status = 'pending_payment_verification'
        ) then
          new.status := old.status;
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_protect_umrah_trip_workflow on public.umrah_trips;
create trigger trg_protect_umrah_trip_workflow
before insert or update on public.umrah_trips
for each row execute function public.protect_umrah_trip_workflow();

alter table public.umrah_posting_payments
  drop constraint if exists umrah_posting_payments_status_check;
alter table public.umrah_posting_payments
  add constraint umrah_posting_payments_status_check
  check (status = any (array[
    'pending','submitted','paid','failed','refunded','verified','rejected'
  ]::text[]));

create unique index if not exists umrah_posting_payments_one_active_per_trip_idx
on public.umrah_posting_payments(trip_id)
where status in ('submitted','paid','verified');

create or replace function public.validate_umrah_posting_payment_insert()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_owner uuid;
  v_agency uuid;
  v_fee numeric;
begin
  if auth.uid() is null or new.payer_id <> auth.uid() then
    raise exception 'Invalid Umrah payment owner';
  end if;

  if new.status <> 'submitted' or new.payment_method <> 'cash' then
    raise exception 'Umrah posting payment must be submitted cash payment';
  end if;

  if new.receipt_url is null
     or new.receipt_url not like (auth.uid()::text || '/umrah-posting-payments/%') then
    raise exception 'Invalid Umrah payment receipt path';
  end if;

  select t.agency_id, a.owner_id, a.posting_fee_iqd
  into v_agency, v_owner, v_fee
  from public.umrah_trips t
  join public.umrah_agencies a on a.id = t.agency_id
  where t.id = new.trip_id
  for update;

  if v_agency is null or v_owner is null then
    raise exception 'Invalid Umrah trip';
  end if;

  if v_owner <> auth.uid()
     or new.agency_id <> v_agency
     or new.amount_iqd <> v_fee
     or coalesce(v_fee,0) <= 0 then
    raise exception 'Umrah posting payment mismatch';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_validate_umrah_posting_payment_insert
on public.umrah_posting_payments;
create trigger trg_validate_umrah_posting_payment_insert
before insert on public.umrah_posting_payments
for each row execute function public.validate_umrah_posting_payment_insert();

create or replace function public.protect_umrah_booking_customer_update()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  allow_booking_payment boolean := false;
  allow_travel_payment boolean := false;
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if new.trip_id is distinct from old.trip_id
     or new.agency_id is distinct from old.agency_id
     or new.customer_id is distinct from old.customer_id
     or new.passenger_name is distinct from old.passenger_name
     or new.phone is distinct from old.phone
     or new.passport_number is distinct from old.passport_number
     or new.passport_issue_date is distinct from old.passport_issue_date
     or new.booking_fee_iqd is distinct from old.booking_fee_iqd
     or new.travel_payment_iqd is distinct from old.travel_payment_iqd
     or new.travel_payment_due_date is distinct from old.travel_payment_due_date then
    new.trip_id := old.trip_id;
    new.agency_id := old.agency_id;
    new.customer_id := old.customer_id;
    new.passenger_name := old.passenger_name;
    new.phone := old.phone;
    new.passport_number := old.passport_number;
    new.passport_issue_date := old.passport_issue_date;
    new.booking_fee_iqd := old.booking_fee_iqd;
    new.travel_payment_iqd := old.travel_payment_iqd;
    new.travel_payment_due_date := old.travel_payment_due_date;
  end if;

  allow_booking_payment :=
    old.booking_payment_status = 'pending'
    and new.booking_payment_status = 'paid'
    and old.status = 'pending_payment'
    and new.status = 'confirmed'
    and exists (
      select 1 from public.umrah_payment_records pr
      where pr.booking_id = old.id
        and pr.customer_id = auth.uid()
        and pr.payment_kind = 'booking_fee'
        and pr.amount_iqd = 3000
        and pr.status in ('submitted','paid','verified')
    );

  allow_travel_payment :=
    old.travel_payment_status in ('not_due','requested')
    and new.travel_payment_status = 'pending'
    and old.status in ('confirmed','documents_pending','travel_payment_due')
    and new.status = 'travel_payment_due'
    and old.travel_payment_due_date is not null
    and old.travel_payment_due_date <= current_date
    and exists (
      select 1 from public.umrah_payment_records pr
      where pr.booking_id = old.id
        and pr.customer_id = auth.uid()
        and pr.payment_kind = 'travel_payment'
        and pr.amount_iqd = old.travel_payment_iqd
        and pr.status in ('submitted','paid','verified')
    );

  if not allow_booking_payment then
    new.booking_payment_status := old.booking_payment_status;
  end if;

  if not allow_travel_payment then
    new.travel_payment_status := old.travel_payment_status;
  end if;

  if not (allow_booking_payment or allow_travel_payment) then
    new.status := old.status;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_protect_umrah_booking_customer_update on public.umrah_bookings;
create trigger trg_protect_umrah_booking_customer_update
before update on public.umrah_bookings
for each row execute function public.protect_umrah_booking_customer_update();

create or replace function public.validate_umrah_booking_insert()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_agency uuid;
  v_status text;
  v_total numeric;
begin
  if auth.uid() is null or new.customer_id <> auth.uid() then
    raise exception 'Invalid Umrah booking owner';
  end if;

  if btrim(coalesce(new.passenger_name,'')) = ''
     or new.passport_issue_date is null then
    raise exception 'Passenger name and passport issue date are required';
  end if;

  if new.travel_payment_due_date is distinct from new.passport_issue_date then
    raise exception 'Travel payment due date must match passport issue date';
  end if;

  select agency_id, status, total_price_iqd
  into v_agency, v_status, v_total
  from public.umrah_trips
  where id = new.trip_id
  for update;

  if v_agency is null or v_status <> 'approved' then
    raise exception 'Umrah trip is not available for booking';
  end if;

  if new.agency_id <> v_agency then
    raise exception 'Umrah agency mismatch';
  end if;

  if new.booking_fee_iqd <> 3000
     or new.travel_payment_iqd <> v_total
     or new.booking_payment_status <> 'pending'
     or new.travel_payment_status <> 'not_due'
     or new.status <> 'pending_payment' then
    raise exception 'Invalid Umrah booking financial state';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_validate_umrah_booking_insert on public.umrah_bookings;
create trigger trg_validate_umrah_booking_insert
before insert on public.umrah_bookings
for each row execute function public.validate_umrah_booking_insert();

create or replace function public.validate_umrah_payment_record_insert()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  b public.umrah_bookings%rowtype;
begin
  if auth.uid() is null or new.customer_id <> auth.uid() then
    raise exception 'Invalid Umrah payment owner';
  end if;

  select * into b
  from public.umrah_bookings
  where id = new.booking_id
  for update;

  if not found or b.customer_id <> auth.uid() or b.agency_id <> new.agency_id then
    raise exception 'Invalid Umrah booking payment relationship';
  end if;

  if new.payment_method <> 'cash' then
    raise exception 'Unsupported Umrah payment method';
  end if;

  if new.payment_kind = 'booking_fee' then
    if new.amount_iqd <> 3000
       or new.status not in ('pending','submitted')
       or b.booking_payment_status <> 'pending' then
      raise exception 'Invalid Umrah booking fee payment';
    end if;
  elsif new.payment_kind = 'travel_payment' then
    if new.amount_iqd <> b.travel_payment_iqd
       or new.status <> 'submitted'
       or b.travel_payment_status not in ('not_due','requested','pending')
       or b.travel_payment_due_date is null
       or b.travel_payment_due_date > current_date then
      raise exception 'Invalid Umrah travel payment';
    end if;
  else
    raise exception 'Invalid Umrah payment kind';
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_validate_umrah_payment_record_insert on public.umrah_payment_records;
create trigger trg_validate_umrah_payment_record_insert
before insert on public.umrah_payment_records
for each row execute function public.validate_umrah_payment_record_insert();

create unique index if not exists umrah_payment_records_one_active_payment_idx
on public.umrah_payment_records(booking_id,payment_kind)
where status in ('submitted','paid','verified');

-- Support tickets: users create/read their own; Support/Admin manage status;
-- Admin is the only role allowed to delete.
alter table public.support_tickets
  drop constraint if exists support_tickets_status_check;
alter table public.support_tickets
  add constraint support_tickets_status_check
  check (status = any (array[
    'open','in_progress','resolved','closed'
  ]::text[]));

create or replace function public.protect_support_ticket_updates()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if auth.uid() is not null and not public.is_admin() then
    if public.current_user_role() = 'support' then
      new.user_id := old.user_id;
      new.subject := old.subject;
      new.message := old.message;
    else
      new.user_id := old.user_id;
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_protect_support_ticket_updates on public.support_tickets;
create trigger trg_protect_support_ticket_updates
before update on public.support_tickets
for each row execute function public.protect_support_ticket_updates();

drop policy if exists support_self on public.support_tickets;
drop policy if exists support_role_read on public.support_tickets;
drop policy if exists support_role_update on public.support_tickets;

create policy support_ticket_select
on public.support_tickets
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.current_user_role() = 'support'
  or public.is_admin()
);

create policy support_ticket_insert
on public.support_tickets
for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy support_ticket_update
on public.support_tickets
for update
to authenticated
using (
  public.current_user_role() = 'support'
  or public.is_admin()
)
with check (
  public.current_user_role() = 'support'
  or public.is_admin()
);

create policy support_ticket_delete_admin
on public.support_tickets
for delete
to authenticated
using (public.is_admin());
