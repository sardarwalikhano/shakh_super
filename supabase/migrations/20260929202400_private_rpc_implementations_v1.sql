-- Stage 18: keep privileged RPC implementations private
-- Preserve all existing public RPC names for frontend compatibility.
-- Public entrypoints are SECURITY INVOKER; privileged implementations live in private.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;

ALTER FUNCTION public.claim_order(uuid) SET SCHEMA private;
ALTER FUNCTION public.create_order_with_stock(uuid,uuid,jsonb) SET SCHEMA private;
ALTER FUNCTION public.create_order_with_stock(uuid,uuid,jsonb,text) SET SCHEMA private;
ALTER FUNCTION public.create_order_with_stock(uuid,uuid,jsonb,text,text) SET SCHEMA private;
ALTER FUNCTION public.get_captain_customer_contact(uuid) SET SCHEMA private;
ALTER FUNCTION public.preview_coupon(text,numeric) SET SCHEMA private;
ALTER FUNCTION public.transition_order_status(uuid,public.order_status) SET SCHEMA private;

CREATE OR REPLACE FUNCTION public.claim_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.claim_order(p_order_id);
$$;

CREATE OR REPLACE FUNCTION public.create_order_with_stock(
  p_store_id uuid, p_address_id uuid, p_items jsonb
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.create_order_with_stock(p_store_id,p_address_id,p_items);
$$;

CREATE OR REPLACE FUNCTION public.create_order_with_stock(
  p_store_id uuid, p_address_id uuid, p_items jsonb, p_payment_method text
)
RETURNS uuid
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.create_order_with_stock(
    p_store_id,p_address_id,p_items,p_payment_method
  );
$$;

CREATE OR REPLACE FUNCTION public.create_order_with_stock(
  p_store_id uuid, p_address_id uuid, p_items jsonb,
  p_payment_method text, p_coupon_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN private.create_order_with_stock(
    p_store_id,p_address_id,p_items,p_payment_method,p_coupon_code
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_captain_customer_contact(p_order_id uuid)
RETURNS TABLE(full_name text, phone text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY SELECT * FROM private.get_captain_customer_contact(p_order_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_coupon(p_code text, p_subtotal numeric)
RETURNS TABLE(
  coupon_id uuid,
  discount_type text,
  discount_value numeric,
  discount_iqd numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY SELECT * FROM private.preview_coupon(p_code,p_subtotal);
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_order_status(
  p_order_id uuid,
  p_next_status public.order_status
)
RETURNS public.orders
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.transition_order_status(p_order_id,p_next_status);
$$;

REVOKE EXECUTE ON FUNCTION private.claim_order(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.get_captain_customer_contact(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.preview_coupon(text,numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION private.transition_order_status(uuid,public.order_status) FROM PUBLIC, anon;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.claim_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.create_order_with_stock(uuid,uuid,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_captain_customer_contact(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.preview_coupon(text,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION private.transition_order_status(uuid,public.order_status) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.claim_order(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_order_with_stock(uuid,uuid,jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_order_with_stock(uuid,uuid,jsonb,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_order_with_stock(uuid,uuid,jsonb,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_captain_customer_contact(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.preview_coupon(text,numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.transition_order_status(uuid,public.order_status) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.claim_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock(uuid,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock(uuid,uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_with_stock(uuid,uuid,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_captain_customer_contact(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_coupon(text,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_order_status(uuid,public.order_status) TO authenticated;

COMMIT;
