alter table public.vehicle_listings
  add column if not exists trim text,
  add column if not exists body_type text,
  add column if not exists drivetrain text,
  add column if not exists engine_size_cc integer,
  add column if not exists cylinders integer,
  add column if not exists horsepower integer,
  add column if not exists doors integer,
  add column if not exists seats integer,
  add column if not exists warranty text,
  add column if not exists service_history text,
  add column if not exists accident_history text,
  add column if not exists import_status text,
  add column if not exists origin_country text,
  add column if not exists plate_status text,
  add column if not exists exchange_allowed boolean not null default false,
  add column if not exists negotiable boolean not null default true,
  add column if not exists inspection_note text;

create index if not exists vehicle_listings_make_model_idx on public.vehicle_listings(make,model);
create index if not exists vehicle_listings_city_idx on public.vehicle_listings(city);
create index if not exists vehicle_listings_price_idx on public.vehicle_listings(price_iqd);
create index if not exists vehicle_listings_year_idx on public.vehicle_listings(model_year);
