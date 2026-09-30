-- SHAKH: keep customer contact details private until an order is assigned.
-- Ready-for-pickup notifications may include operational order data,
-- but customer phone/WhatsApp are revealed only after captain claim.
begin;

create or replace function private.notify_online_captains_order_ready()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_store jsonb; v_address jsonb; v_customer jsonb; v_items jsonb; v_packet jsonb; v_body text;
begin
  if new.status<>'ready_for_pickup'::public.order_status or old.status=new.status or new.captain_id is not null then return new; end if;

  select jsonb_build_object('name',s.name,'address',s.address,'city',s.city,'latitude',s.latitude,'longitude',s.longitude) into v_store from public.stores s where s.id=new.store_id;
  select jsonb_build_object('label',da.label,'address',da.address,'delivery_note',da.delivery_note,'city',da.city,'latitude',da.latitude,'longitude',da.longitude) into v_address from public.delivery_addresses da where da.id=new.address_id;
  select jsonb_build_object('full_name',p.full_name) into v_customer from public.profiles p where p.id=new.customer_id;
  select coalesce(jsonb_agg(jsonb_build_object('product_name',oi.product_name,'quantity',oi.quantity,'unit_price_iqd',oi.unit_price_iqd,'options',oi.options) order by oi.id),'[]'::jsonb) into v_items from public.order_items oi where oi.order_id=new.id;

  v_packet=jsonb_build_object('order_id',new.id,'status',new.status,'store',coalesce(v_store,'{}'::jsonb),'delivery_address',coalesce(v_address,'{}'::jsonb),'customer',coalesce(v_customer,'{}'::jsonb),'items',coalesce(v_items,'[]'::jsonb),'subtotal_iqd',new.subtotal_iqd,'delivery_fee_iqd',new.delivery_fee_iqd,'platform_fee_iqd',new.platform_fee_iqd,'discount_iqd',new.discount_iqd,'total_iqd',new.total_iqd,'payment_method',new.payment_method,'payment_status',new.payment_status);
  v_body='ئۆردەرێکی نوێ ئامادەی گەیاندنە — #'||left(new.id::text,8)||E'\nدوکان: '||coalesce(v_store->>'name','—')||E'\nکڕیار: '||coalesce(v_customer->>'full_name','—')||E'\nشوێنی گەیاندن: '||coalesce(v_address->>'address','—')||case when nullif(v_address->>'delivery_note','') is not null then E'\nتێبینی: '||v_address->>'delivery_note' else '' end||E'\nکۆی گشتی: '||to_char(coalesce(new.total_iqd,0),'FM999,999,999,990.00')||' د.ع';

  insert into public.notifications(user_id,type,title,body,is_read,data)
  select c.user_id,'captain_order_ready','ئۆردەرێکی نوێ ئامادەی گەیاندنە',v_body,false,v_packet
  from public.captains c join public.user_roles ur on ur.user_id=c.user_id and ur.role='captain'::public.app_role and ur.is_active=true
  where coalesce(c.is_online,false)=true;
  return new;
end;
$function$;

revoke all on function private.notify_online_captains_order_ready() from public,anon,authenticated;
commit;