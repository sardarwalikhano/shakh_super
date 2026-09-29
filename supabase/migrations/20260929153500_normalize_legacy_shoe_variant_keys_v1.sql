-- Normalize legacy camelCase shoe variant keys to the snake_case keys
-- consumed by checkout/UI, without removing the original keys.

create or replace function public.normalize_product_variant_keys()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if jsonb_typeof(coalesce(new.variants, '[]'::jsonb)) = 'array' then
    with normalized_sizes as (
      select ord,
        case
          when jsonb_typeof(v) = 'object'
            and (v ? 'shoeSizes')
            and not (v ? 'shoe_sizes')
            then jsonb_set(v, '{shoe_sizes}', v->'shoeSizes', true)
          else v
        end as v
      from jsonb_array_elements(new.variants) with ordinality as x(v, ord)
    ),
    normalized_single as (
      select ord,
        case
          when jsonb_typeof(v) = 'object'
            and (v ? 'shoeSize')
            and not (v ? 'shoe_size')
            then jsonb_set(v, '{shoe_size}', v->'shoeSize', true)
          else v
        end as v
      from normalized_sizes
    )
    select coalesce(jsonb_agg(v order by ord), '[]'::jsonb)
      into new.variants
    from normalized_single;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_normalize_product_variant_keys on public.products;

create trigger trg_normalize_product_variant_keys
before insert or update of variants on public.products
for each row
execute function public.normalize_product_variant_keys();

update public.products
set variants = variants
where variants is not null;
