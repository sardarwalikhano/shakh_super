-- SHAKH: notify post owners when moderation status changes
-- Backward-compatible: adds a private trigger function and trigger only.

create schema if not exists private;

create or replace function private.notify_post_moderation()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.status is distinct from old.status
     and new.author_id is not null
     and new.status in ('approved','rejected') then
    insert into public.notifications(user_id,title,body,type,data)
    values (
      new.author_id,
      case when new.status='approved' then 'پۆستەکەت پەسەند کرا' else 'پۆستەکەت ڕەتکرایەوە' end,
      case when new.status='approved'
        then 'پۆستەکەت لە شاخ بڵاوکرایەوە.'
        else coalesce('هۆکار: '||nullif(new.rejection_reason,''),'پۆستەکەت پێویستی بە پێداچوونەوە هەیە.')
      end,
      'post_moderation',
      jsonb_build_object('post_id',new.id,'status',new.status)
    );
  end if;
  return new;
end;
$$;

revoke all on function private.notify_post_moderation() from public;

drop trigger if exists trg_post_moderation_notification on public.posts;

create trigger trg_post_moderation_notification
after update of status on public.posts
for each row
execute function private.notify_post_moderation();
