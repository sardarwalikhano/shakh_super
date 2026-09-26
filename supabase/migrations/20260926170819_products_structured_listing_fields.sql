alter table public.products
  add column if not exists product_type text,
  add column if not exists brand text,
  add column if not exists size text;

create index if not exists products_brand_idx on public.products(brand);
create index if not exists products_type_idx on public.products(product_type);
