-- SHAKH: exact delivery place + contact readiness hardening.
-- Additive only. Existing rows remain untouched.

begin;

alter table public.delivery_addresses
  add column if not exists delivery_note text;

alter table public.delivery_addresses
  drop constraint if exists delivery_addresses_delivery_note_length_check;

alter table public.delivery_addresses
  add constraint delivery_addresses_delivery_note_length_check
  check (delivery_note is null or char_length(delivery_note) <= 500);

alter table public.profiles
  add column if not exists whatsapp_phone text;

alter table public.profiles
  drop constraint if exists profiles_phone_length_check;

alter table public.profiles
  add constraint profiles_phone_length_check
  check (phone is null or char_length(phone) <= 30);

alter table public.profiles
  drop constraint if exists profiles_whatsapp_phone_length_check;

alter table public.profiles
  add constraint profiles_whatsapp_phone_length_check
  check (whatsapp_phone is null or char_length(whatsapp_phone) <= 30);

create or replace function public.require_profile_contact_details()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if auth.uid() is not null
     and new.id = auth.uid()
     and not public.is_admin() then
    if btrim(coalesce(new.phone,'')) = ''
       or btrim(coalesce(new.whatsapp_phone,'')) = '' then
      raise exception 'PROFILE_CONTACT_REQUIRED'
        using detail = 'Phone and WhatsApp are required before placing orders.';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_require_profile_contact_details on public.profiles;
create trigger trg_require_profile_contact_details
before update on public.profiles
for each row
execute function public.require_profile_contact_details();

commit;
