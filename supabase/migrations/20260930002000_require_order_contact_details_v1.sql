-- SHAKH: enforce customer mobile + WhatsApp before order creation.
-- Additive only. Existing orders are untouched.

begin;

create or replace function public.require_order_contact_details()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_phone text;
  v_whatsapp_phone text;
begin
  if auth.uid() is not null
     and new.customer_id = auth.uid()
     and not public.is_admin() then
    select phone, whatsapp_phone
      into v_phone, v_whatsapp_phone
    from public.profiles
    where id = new.customer_id;

    if btrim(coalesce(v_phone,'')) = ''
       or btrim(coalesce(v_whatsapp_phone,'')) = '' then
      raise exception 'PROFILE_CONTACT_REQUIRED'
        using detail = 'Phone and WhatsApp are required before placing orders.';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_require_order_contact_details on public.orders;
create trigger trg_require_order_contact_details
before insert on public.orders
for each row
execute function public.require_order_contact_details();

commit;
