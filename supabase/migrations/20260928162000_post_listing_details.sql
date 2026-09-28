alter table public.posts
  add column if not exists listing_details jsonb not null default '{}'::jsonb;

create index if not exists posts_listing_details_gin_idx
  on public.posts using gin (listing_details);
