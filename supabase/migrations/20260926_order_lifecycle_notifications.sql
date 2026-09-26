-- SHAKH v1.6.0 — Order lifecycle + notifications foundation
-- Apply this migration in Supabase SQL Editor before enabling the notification UI.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  type text not null default 'order_update',
  title_ku text not null,
  body_ku text not null,
  title_ar text,
  body_ar text,
  title_en text,
  body_en text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

create index if not exists notifications_order_idx
  on public.notifications(order_id);

alter table public.notifications enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users update own notifications" on public.notifications;
create policy "users update own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Status history gives the customer, store and captain one auditable timeline.
create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists order_status_history_order_idx
  on public.order_status_history(order_id, created_at asc);

alter table public.order_status_history enable row level security;

drop policy if exists "customers read own order history" on public.order_status_history;
create policy "customers read own order history"
  on public.order_status_history for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and o.customer_id = auth.uid()
    )
  );

-- Realtime delivery of notification rows to signed-in clients.
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.order_status_history;
