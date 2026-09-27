-- SHAKH: refine post labels by verified publisher role
-- Backward-compatible: no data deletion; updates metadata only.

create or replace function public.prepare_post_role_metadata()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  resolved_role text;
begin
  resolved_role := public.current_user_role();
  if resolved_role is null then
    raise exception 'A valid active role is required to create or update a post';
  end if;

  if new.author_id <> auth.uid() and not public.is_admin() then
    raise exception 'You can only create or update your own posts';
  end if;

  if new.post_type is null or new.post_type = '' then
    new.post_type := case resolved_role
      when 'restaurant_vendor' then 'food'
      when 'fashion_vendor' then 'fashion'
      when 'car_dealer' then 'car'
      when 'umrah_agency' then 'umrah'
      when 'captain' then 'delivery'
      when 'admin' then 'announcement'
      when 'super_admin' then 'announcement'
      else 'marketplace'
    end;
  end if;

  if not public.is_admin() then
    if resolved_role = 'restaurant_vendor' and new.post_type <> 'food' then
      raise exception 'Restaurant vendors can only publish food posts';
    end if;
    if resolved_role = 'fashion_vendor' and new.post_type <> 'fashion' then
      raise exception 'Fashion vendors can only publish fashion posts';
    end if;
    if resolved_role = 'car_dealer' and new.post_type <> 'car' then
      raise exception 'Car dealers can only publish car posts';
    end if;
    if resolved_role = 'umrah_agency' and new.post_type <> 'umrah' then
      raise exception 'Umrah agencies can only publish Umrah posts';
    end if;
    if resolved_role = 'captain' and new.post_type <> 'delivery' then
      raise exception 'Captains can only publish delivery posts';
    end if;
    if resolved_role = 'customer' and new.post_type not in ('general','marketplace') then
      raise exception 'Customers can only publish general or marketplace posts';
    end if;
  end if;

  new.publisher_role := resolved_role;

  new.label := case
    when resolved_role = 'restaurant_vendor' then 'خواردنگە'
    when resolved_role = 'supermarket_vendor' then 'سووپەرمارکێت'
    when resolved_role = 'fashion_vendor' then 'جلوبەرگ'
    when resolved_role = 'electronics_vendor' then 'ئەلیکترۆنیات'
    when resolved_role = 'jewelry_vendor' then 'جواکاری'
    when resolved_role = 'vendor' then 'بازاڕ'
    when resolved_role = 'car_dealer' then 'ئۆتۆمبێل'
    when resolved_role = 'umrah_agency' then 'عومرە'
    when resolved_role = 'captain' then 'گەیاندن'
    when resolved_role in ('admin','super_admin') and new.post_type = 'support' then 'پشتگیری'
    when resolved_role in ('admin','super_admin') then 'ئاگاداری'
    when new.post_type = 'food' then 'خواردنگە'
    when new.post_type = 'fashion' then 'جلوبەرگ'
    when new.post_type = 'car' then 'ئۆتۆمبێل'
    when new.post_type = 'umrah' then 'عومرە'
    when new.post_type = 'delivery' then 'گەیاندن'
    when new.post_type = 'marketplace' then 'بازاڕ'
    when new.post_type = 'announcement' then 'ئاگاداری'
    when new.post_type = 'support' then 'پشتگیری'
    else 'گشتی'
  end;

  new.updated_at := now();
  return new;
end;
$$;

update public.posts p
set publisher_role = coalesce(nullif(p.publisher_role,''), 'customer'),
    label = case
      when coalesce(nullif(p.publisher_role,''),'customer') = 'restaurant_vendor' then 'خواردنگە'
      when coalesce(nullif(p.publisher_role,''),'customer') = 'supermarket_vendor' then 'سووپەرمارکێت'
      when coalesce(nullif(p.publisher_role,''),'customer') = 'fashion_vendor' then 'جلوبەرگ'
      when coalesce(nullif(p.publisher_role,''),'customer') = 'electronics_vendor' then 'ئەلیکترۆنیات'
      when coalesce(nullif(p.publisher_role,''),'customer') = 'jewelry_vendor' then 'جواکاری'
      when coalesce(nullif(p.publisher_role,''),'customer') = 'vendor' then 'بازاڕ'
      when coalesce(nullif(p.publisher_role,''),'customer') = 'car_dealer' then 'ئۆتۆمبێل'
      when coalesce(nullif(p.publisher_role,''),'customer') = 'umrah_agency' then 'عومرە'
      when coalesce(nullif(p.publisher_role,''),'customer') = 'captain' then 'گەیاندن'
      when p.post_type = 'announcement' then 'ئاگاداری'
      when p.post_type = 'support' then 'پشتگیری'
      when p.post_type = 'food' then 'خواردنگە'
      when p.post_type = 'fashion' then 'جلوبەرگ'
      when p.post_type = 'car' then 'ئۆتۆمبێل'
      when p.post_type = 'umrah' then 'عومرە'
      when p.post_type = 'delivery' then 'گەیاندن'
      when p.post_type = 'marketplace' then 'بازاڕ'
      else 'گشتی'
    end
where publisher_role is null or publisher_role = ''
   or label is null or label = '';

