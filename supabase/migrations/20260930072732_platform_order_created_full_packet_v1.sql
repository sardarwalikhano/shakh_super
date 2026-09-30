-- SHAKH: notify platform admins with the complete order packet when an order is created.
begin;
create or replace function private.notify_platform_order_created()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare v_store jsonb;v_address jsonb;v_customer jsonb;v_items jsonb;v_packet jsonb;v_body text;
begin
 select jsonb_build_object('name',s.name,'address',s.address,'city',s.city,'latitude',s.latitude,'longitude',s.longitude) into v_store from public.stores s where s.id=new.store_id;
 select jsonb_build_object('label',da.label,'address',da.address,'delivery_note',da.delivery_note,'city',da.city,'latitude',da.latitude,'longitude',da.longitude) into v_address from public.delivery_addresses da where da.id=new.address_id;
 select jsonb_build_object('full_name',p.full_name,'email',p.email,'phone',p.phone,'whatsapp_phone',p.whatsapp_phone) into v_customer from public.profiles p where p.id=new.customer_id;
 select coalesce(jsonb_agg(jsonb_build_object('product_name',oi.product_name,'quantity',oi.quantity,'unit_price_iqd',oi.unit_price_iqd,'options',oi.options) order by oi.id),'[]'::jsonb) into v_items from public.order_items oi where oi.order_id=new.id;
 v_packet=jsonb_build_object('order_id',new.id,'status',new.status,'store',coalesce(v_store,'{}'::jsonb),'delivery_address',coalesce(v_address,'{}'::jsonb),'customer',coalesce(v_customer,'{}'::jsonb),'items',coalesce(v_items,'[]'::jsonb),'subtotal_iqd',new.subtotal_iqd,'delivery_fee_iqd',new.delivery_fee_iqd,'platform_fee_iqd',new.platform_fee_iqd,'discount_iqd',new.discount_iqd,'total_iqd',new.total_iqd,'payment_method',new.payment_method,'payment_status',new.payment_status,'created_at',new.created_at);
 v_body='ئۆردەری نوێ بۆ پلاتفۆرم هات — #'||left(new.id::text,8)||E'\nدوکان: '||coalesce(v_store->>'name','—')||E'\nکڕیار: '||coalesce(v_customer->>'full_name','—')||E'\nشوێنی گەیاندن: '||coalesce(v_address->>'address','—')||E'\nکۆی گشتی: '||to_char(coalesce(new.total_iqd,0),'FM999,999,999,990.00')||' د.ع';
 insert into public.notifications(user_id,type,title,body,is_read,data)
 select ur.user_id,'platform_order_created','ئۆردەری نوێ تۆمار کرا',v_body,false,v_packet
 from public.user_roles ur where ur.role in ('admin'::public.app_role,'super_admin'::public.app_role) and ur.is_active=true;
 return new;
end;
$function$;
revoke all on function private.notify_platform_order_created() from public,anon,authenticated;
drop trigger if exists trg_notify_platform_order_created on public.orders;
create trigger trg_notify_platform_order_created after insert on public.orders for each row execute function private.notify_platform_order_created();
commit;