-- SHAKH Stage 6: indexes for order financial ledger foreign keys.
CREATE INDEX IF NOT EXISTS order_financials_customer_id_idx ON public.order_financials(customer_id);
CREATE INDEX IF NOT EXISTS order_financials_vendor_id_idx ON public.order_financials(vendor_id);
CREATE INDEX IF NOT EXISTS order_financials_captain_id_idx ON public.order_financials(captain_id);
CREATE INDEX IF NOT EXISTS order_financials_store_id_idx ON public.order_financials(store_id);
