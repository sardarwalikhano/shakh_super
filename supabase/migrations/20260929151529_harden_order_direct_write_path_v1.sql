-- SHAKH: close direct client writes to order ledger tables.
-- Checkout and lifecycle mutations are performed through SECURITY DEFINER RPCs
-- that authenticate the caller and enforce stock/payment/status invariants.

REVOKE INSERT, UPDATE, DELETE ON public.orders FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.order_items FROM anon, authenticated;

DROP POLICY IF EXISTS orders_insert ON public.orders;
DROP POLICY IF EXISTS orders_update_delivery ON public.orders;
DROP POLICY IF EXISTS orders_update_vendor ON public.orders;
DROP POLICY IF EXISTS order_items_insert ON public.order_items;
