-- SHAKH Stage 8: product inventory and marketplace access hardening.

UPDATE public.products
SET stock = 0
WHERE stock IS NULL;

ALTER TABLE public.products
  ALTER COLUMN stock SET DEFAULT 0,
  ALTER COLUMN stock SET NOT NULL;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_stock_nonnegative,
  ADD CONSTRAINT products_stock_nonnegative CHECK (stock >= 0),
  DROP CONSTRAINT IF EXISTS products_sale_price_not_above_price,
  ADD CONSTRAINT products_sale_price_not_above_price
    CHECK (sale_price_iqd IS NULL OR sale_price_iqd <= price_iqd);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.products FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.stores FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.categories FROM anon;
REVOKE ALL ON TABLE public.carts FROM anon;
REVOKE ALL ON TABLE public.cart_items FROM anon;
