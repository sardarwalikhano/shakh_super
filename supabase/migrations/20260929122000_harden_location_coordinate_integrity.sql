alter table public.stores
  drop constraint if exists stores_latitude_range_check,
  drop constraint if exists stores_longitude_range_check,
  drop constraint if exists stores_latitude_longitude_pair_check;

alter table public.stores
  add constraint stores_latitude_range_check
    check (latitude is null or latitude between -90 and 90),
  add constraint stores_longitude_range_check
    check (longitude is null or longitude between -180 and 180),
  add constraint stores_latitude_longitude_pair_check
    check ((latitude is null) = (longitude is null));

alter table public.delivery_addresses
  drop constraint if exists delivery_addresses_latitude_range_check,
  drop constraint if exists delivery_addresses_longitude_range_check,
  drop constraint if exists delivery_addresses_latitude_longitude_pair_check;

alter table public.delivery_addresses
  add constraint delivery_addresses_latitude_range_check
    check (latitude is null or latitude between -90 and 90),
  add constraint delivery_addresses_longitude_range_check
    check (longitude is null or longitude between -180 and 180),
  add constraint delivery_addresses_latitude_longitude_pair_check
    check ((latitude is null) = (longitude is null));
