create or replace function public.create_order_with_stock(p_store_id uuid,p_address_id uuid,p_items jsonb)
returns uuid
language plpgsql security definer
set search_path to 'public','pg_temp'
as $function$
declare
 v_user uuid:=auth.uid(); v_order_id uuid; v_item record; v_product public.products%rowtype;
 v_subtotal numeric:=0; v_delivery_fee numeric:=1000; v_platform_fee numeric:=250; v_total numeric;
begin
 if v_user is null then raise exception 'Authentication required'; end if;
 if p_store_id is null then raise exception 'Store is required'; end if;
 if p_address_id is null or not exists(select 1 from public.delivery_addresses where id=p_address_id and user_id=v_user) then raise exception 'Invalid delivery address'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Cart is empty'; end if;
 select coalesce(default_delivery_fee_iqd,1000),coalesce(platform_fee_iqd,250) into v_delivery_fee,v_platform_fee from public.platform_settings where id=true;
 for v_item in select product_id,coalesce(options,'{}'::jsonb) options,sum(quantity)::integer quantity from jsonb_to_recordset(p_items) x(product_id uuid,quantity integer,options jsonb) group by product_id,coalesce(options,'{}'::jsonb)
 loop
  if v_item.product_id is null or v_item.quantity<=0 then raise exception 'Invalid cart item'; end if;
  select * into v_product from public.products where id=v_item.product_id for update;
  if not found then raise exception 'Product not found'; end if;
  if v_product.store_id<>p_store_id then raise exception 'All products must belong to the same store'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(v_product.variants,'[]'::jsonb)) v where jsonb_typeof(v->'shoe_sizes')='array' and jsonb_array_length(v->'shoe_sizes')>0) then
   if coalesce(v_item.options->>'shoe_size','')='' then raise exception 'Shoe size is required for product %',v_product.name_ku; end if;
   if not exists(select 1 from jsonb_array_elements(coalesce(v_product.variants,'[]'::jsonb)) v where (jsonb_typeof(v->'shoe_sizes')='array' and exists(select 1 from jsonb_array_elements_text(v->'shoe_sizes') s where s=v_item.options->>'shoe_size')) or v->>'shoe_size'=v_item.options->>'shoe_size') then raise exception 'Selected shoe size % is not available for product %',v_item.options->>'shoe_size',v_product.name_ku; end if;
  end if;
  if not v_product.is_available or coalesce(v_product.stock,0)<v_item.quantity then raise exception 'Insufficient stock for product %',v_product.name_ku; end if;
  v_subtotal:=v_subtotal+coalesce(v_product.sale_price_iqd,v_product.price_iqd)*v_item.quantity;
 end loop;
 v_total:=v_subtotal+v_delivery_fee+v_platform_fee;
 insert into public.orders(customer_id,store_id,status,address_id,subtotal_iqd,delivery_fee_iqd,platform_fee_iqd,discount_iqd,total_iqd,payment_status,payment_method)
 values(v_user,p_store_id,'pending',p_address_id,v_subtotal,v_delivery_fee,v_platform_fee,0,v_total,'pending','cash') returning id into v_order_id;
 for v_item in select product_id,coalesce(options,'{}'::jsonb) options,sum(quantity)::integer quantity from jsonb_to_recordset(p_items) x(product_id uuid,quantity integer,options jsonb) group by product_id,coalesce(options,'{}'::jsonb)
 loop
  select * into v_product from public.products where id=v_item.product_id for update;
  insert into public.order_items(order_id,product_id,product_name,quantity,unit_price_iqd,options)
  values(v_order_id,v_product.id,v_product.name_ku,v_item.quantity,coalesce(v_product.sale_price_iqd,v_product.price_iqd),v_item.options);
  update public.products set stock=greatest(0,coalesce(stock,0)-v_item.quantity),is_available=case when coalesce(stock,0)-v_item.quantity<=0 then false else is_available end,updated_at=now() where id=v_product.id;
 end loop;
 return v_order_id;
end;
$function$;

create or replace function public.handle_order_status_change()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
 status_title text; status_body text; store_owner uuid; v_order_pref boolean:=true; v_delivery_pref boolean:=true;
begin
 if tg_op='INSERT' or new.status is distinct from old.status or new.captain_id is distinct from old.captain_id then
  status_title:=case new.status when 'pending' then 'داواکارییەکەت تۆمار کرا' when 'accepted' then 'داواکارییەکەت قبوڵ کرا' when 'preparing' then 'داواکارییەکەت ئامادە دەکرێت' when 'ready_for_pickup' then 'داواکارییەکە ئامادەی وەرگرتنە' when 'assigned_to_captain' then 'کاپتن بۆ داواکارییەکەت دیاریکرا' when 'picked_up' then 'کاپتن داواکارییەکەی وەرگرت' when 'on_the_way' then 'داواکارییەکەت لە ڕێگایە' when 'delivered' then 'داواکارییەکەت گەیەندرا' when 'cancelled' then 'داواکارییەکەت هەڵوەشێنرایەوە' else 'دۆخی داواکاری نوێکرایەوە' end;
  status_body:=case new.status when 'pending' then 'داواکارییەکەت بە سەرکەوتوویی تۆمار کرا و لە چاوەڕوانییە.' when 'accepted' then 'دوکان داواکارییەکەی قبوڵ کرد.' when 'preparing' then 'دوکان دەستی بە ئامادەکردنی داواکارییەکە کردووە.' when 'ready_for_pickup' then 'داواکارییەکە ئامادەی وەرگرتنە.' when 'assigned_to_captain' then 'کاپتنێک بۆ گەیاندنی داواکارییەکەت دیاریکرا.' when 'picked_up' then 'کاپتن داواکارییەکەی لە دوکان وەرگرت.' when 'on_the_way' then 'کاپتن لە ڕێگای گەیاندنی داواکارییەکەتە.' when 'delivered' then 'داواکارییەکەت بە سەرکەوتوویی گەیەندرا.' when 'cancelled' then 'داواکارییەکەت هەڵوەشێنرایەوە.' else 'دۆخی داواکارییەکەت نوێ کرایەوە.' end;
  select coalesce(order_notifications,true),coalesce(delivery_notifications,true) into v_order_pref,v_delivery_pref from public.user_preferences where user_id=new.customer_id;
  if tg_op='INSERT' or new.status is distinct from old.status then insert into public.order_status_history(order_id,status,changed_by) values(new.id,new.status,auth.uid()); end if;
  if new.customer_id is not null and (tg_op='INSERT' or new.status is distinct from old.status) and v_order_pref then insert into public.notifications(user_id,title,body,type,is_read,data) values(new.customer_id,status_title,status_body,'order_status',false,jsonb_build_object('order_id',new.id,'status',new.status)); end if;
  if new.captain_id is not null and (tg_op='INSERT' or new.captain_id is distinct from old.captain_id or new.status is distinct from old.status) and new.captain_id is distinct from new.customer_id then insert into public.notifications(user_id,title,body,type,is_read,data) values(new.captain_id,'نوێکردنەوەی گەیاندن',status_body,'delivery',false,jsonb_build_object('order_id',new.id,'status',new.status)); end if;
  if new.captain_id is not null and new.captain_id is distinct from old.captain_id and new.status='assigned_to_captain' and v_delivery_pref then insert into public.notifications(user_id,title,body,type,is_read,data) values(new.customer_id,'شوێنی گەیاندنەکەت بۆ کاپتن دەرکرا','کاپتن بۆ ئەم ئۆردەرە دیاریکراوە و دەتوانێت شوێنی گەیاندنەکەت ببینێت بۆ ئەنجامدانی گەیاندن.','location_privacy',false,jsonb_build_object('order_id',new.id,'captain_id',new.captain_id,'status',new.status)); end if;
  select s.owner_id into store_owner from public.stores s where s.id=new.store_id;
  if store_owner is not null and (tg_op='INSERT' or new.status is distinct from old.status) and store_owner is distinct from new.customer_id and store_owner is distinct from new.captain_id then insert into public.notifications(user_id,title,body,type,is_read,data) values(store_owner,'نوێکردنەوەی ئۆردەر',status_body,'vendor_order',false,jsonb_build_object('order_id',new.id,'status',new.status)); end if;
 end if;
 return new;
end;
$function$;