-- SHAKH Phase 2: make Admin permissions explicit in the RBAC catalog.
-- Additive and idempotent. No existing permissions or role assignments are removed.

insert into public.permissions(key,label_ku,description_ku) values
('users.read','بینینی بەکارهێنەران','بینینی زانیاریی بەکارهێنەران بە پێی دەسەڵات'),
('vendors.read','بینینی فرۆشیاران','بینینی فرۆشیار و دامەزراوەکانی بازار'),
('captains.read','بینینی کاپتنەکان','بینینی کاپتن و دۆخی چالاکییەکان'),
('reports.read','بینینی ڕاپۆرتەکان','بینینی ڕاپۆرت و پوختەی ئۆپەریشن'),
('orders.read_all','بینینی هەموو ئۆردەرەکان','دەستگەیشتن بە هەموو ئۆردەرەکانی پلاتفۆرم')
on conflict(key) do update
set label_ku=excluded.label_ku,
    description_ku=excluded.description_ku;

insert into public.role_permissions(role,permission_key)
select 'admin'::public.app_role,p.key
from public.permissions p
where p.key in (
  'dashboard.read',
  'users.read',
  'orders.read',
  'orders.manage',
  'orders.read_all',
  'posts.moderate',
  'captain.zone.manage',
  'vendors.read',
  'captains.read',
  'reports.read',
  'support.manage',
  'settings.manage',
  'wallet.read'
)
on conflict(role,permission_key) do nothing;
