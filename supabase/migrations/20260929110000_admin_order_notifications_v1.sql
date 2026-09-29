create or replace function public.handle_order_status_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
 status_title text;
 status_body text;
 store_owner uuid;
 admin_user record;
 v_order_pref boolean:=true;
 v_delivery_pref boolean:=true;
begin
 if tg_op='INSERT' or new.status is distinct from old.status or new.captain_id is distinct from old.captain_id then
  status_title:=case new.status
   when 'pending' then 'داواکارییەکەت تۆمار کرا'
   when 'accepted' then 'داواکارییەکەت قبوڵ کرا'
   when 'preparing' then 'داواکارییەکەت ئامادە دەکرێت'
   when 'ready_for_pickup' then 'داواکارییەکە ئامادەی وەرگرتنە'
   when 'assigned_to_captain' then 'کاپتن بۆ داواکارییەکەت دیاریکرا'
   when 'picked_up' then 'کاپتن داواکارییەکەی وەرگرت'
   when 'on_the_way' then 'داواکارییەکەت لە ڕێگایە'
   when 'delivered' then 'داواکارییەکەت گەیەندرا'
   when 'cancelled' then 'داواکارییەکەت هەڵوەشێنرایەوە'
   else 'دۆخی داواکاری نوێکرایەوە' end;
  status_body:=case new.status
   when 'pending' then 'داواکارییەکەت بە سەرکەوتوویی تۆمار کرا و لە چاوەڕوانییە.'
   when 'accepted' then 'دوکان داواکارییەکەی قبوڵ کرد.'
   when 'preparing' then 'دوکان دەستی بە ئامادەکردنی داواکارییەکە کردووە.'
   when 'ready_for_pickup' then 'داواکارییەکە ئامادەی وەرگرتنە.'
   when 'assigned_to_captain' then 'کاپتنێک بۆ گەیاندنی داواکارییەکەت دیاریکرا.'
   when 'picked_up' then 'کاپتن داواکارییەکەی لە دوکان وەرگرت.'
   when 'on_the_way' then 'کاپتن لە ڕێگای گەیاندنی داواکارییەکەتە.'
   when 'delivered' then 'داواکارییەکەت بە سەرکەوتوویی گەیەندرا.'
   when 'cancelled' then 'داواکارییەکەت هەڵوەشێنرایەوە.'
   else 'دۆخی داواکارییەکەت نوێ کرایەوە.' end;

  select coalesce(order_notifications,true),coalesce(delivery_notifications,true)
  into v_order_pref,v_delivery_pref
  from public.user_preferences
  where user_id=new.customer_id;

  if tg_op='INSERT' or new.status is distinct from old.status then
   insert into public.order_status_history(order_id,status,changed_by)
   values(new.id,new.status,auth.uid());
  end if;

  if new.customer_id is not null
     and (tg_op='INSERT' or new.status is distinct from old.status)
     and v_order_pref then
   insert into public.notifications(user_id,title,body,type,is_read,data)
   values(new.customer_id,status_title,status_body,'order_status',false,
     jsonb_build_object('order_id',new.id,'status',new.status));
  end if;

  if new.captain_id is not null
     and (tg_op='INSERT' or new.captain_id is distinct from old.captain_id or new.status is distinct from old.status)
     and new.captain_id is distinct from new.customer_id then
   insert into public.notifications(user_id,title,body,type,is_read,data)
   values(new.captain_id,'نوێکردنەوەی گەیاندن',status_body,'delivery',false,
     jsonb_build_object('order_id',new.id,'status',new.status));
  end if;

  if new.captain_id is not null
     and new.captain_id is distinct from old.captain_id
     and new.status='assigned_to_captain'
     and v_delivery_pref
     and new.customer_id is not null then
   insert into public.notifications(user_id,title,body,type,is_read,data)
   values(new.customer_id,'شوێنی گەیاندنەکەت بۆ کاپتن دەرکرا',
     'کاپتن بۆ ئەم ئۆردەرە دیاریکراوە و دەتوانێت شوێنی گەیاندنەکەت ببینێت بۆ ئەنجامدانی گەیاندن.',
     'location_privacy',false,
     jsonb_build_object('order_id',new.id,'captain_id',new.captain_id,'status',new.status));
  end if;

  select s.owner_id into store_owner from public.stores s where s.id=new.store_id;
  if store_owner is not null
     and (tg_op='INSERT' or new.status is distinct from old.status)
     and store_owner is distinct from new.customer_id
     and store_owner is distinct from new.captain_id then
   insert into public.notifications(user_id,title,body,type,is_read,data)
   values(store_owner,
     case when new.status='pending' then 'ئۆردەری نوێ بۆ دوکان' else 'نوێکردنەوەی ئۆردەر' end,
     case when new.status='pending' then 'کڕیارێک ئۆردەرێکی نوێی بۆ دوکانەکەت داوا کردووە.' else status_body end,
     'vendor_order',false,
     jsonb_build_object('order_id',new.id,'status',new.status,'store_id',new.store_id));
  end if;

  if tg_op='INSERT' and new.status='pending' then
   for admin_user in
     select id from public.profiles
     where role in ('super_admin','admin')
       and id is distinct from new.customer_id
   loop
     insert into public.notifications(user_id,title,body,type,is_read,data)
     values(
       admin_user.id,
       'ئۆردەری نوێی شاخ',
       'داواکارییەکی نوێ لە شاخ تۆمار کراوە.',
       'admin_order',
       false,
       jsonb_build_object('order_id',new.id,'store_id',new.store_id,'customer_id',new.customer_id,'status',new.status)
     );
   end loop;
  end if;
 end if;
 return new;
end;
$function$;