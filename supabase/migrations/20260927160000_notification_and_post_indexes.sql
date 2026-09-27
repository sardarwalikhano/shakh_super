-- SHAKH: indexes for notification center and unread badge
-- Backward-compatible: indexes only; no rows are changed or removed.

create index if not exists notifications_user_read_created_idx
  on public.notifications(user_id, is_read, created_at desc);

create index if not exists posts_author_created_idx
  on public.posts(author_id, created_at desc);
