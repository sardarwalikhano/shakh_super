-- Stage 17: reduce redundant permissive RLS policies without changing access semantics

BEGIN;

DROP POLICY IF EXISTS categories_admin ON public.categories;
DROP POLICY IF EXISTS categories_public ON public.categories;

CREATE POLICY categories_public
ON public.categories
FOR SELECT
TO anon
USING (is_active = true);

CREATE POLICY categories_authenticated_select
ON public.categories
FOR SELECT
TO authenticated
USING (is_active = true OR (SELECT is_admin()));

CREATE POLICY categories_admin_insert
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK ((SELECT is_admin()));

CREATE POLICY categories_admin_update
ON public.categories
FOR UPDATE
TO authenticated
USING ((SELECT is_admin()))
WITH CHECK ((SELECT is_admin()));

CREATE POLICY categories_admin_delete
ON public.categories
FOR DELETE
TO authenticated
USING ((SELECT is_admin()));

DROP POLICY IF EXISTS settings_admin ON public.platform_settings;

CREATE POLICY settings_admin_insert
ON public.platform_settings
FOR INSERT
TO authenticated
WITH CHECK ((SELECT is_admin()));

CREATE POLICY settings_admin_update
ON public.platform_settings
FOR UPDATE
TO authenticated
USING ((SELECT is_admin()))
WITH CHECK ((SELECT is_admin()));

CREATE POLICY settings_admin_delete
ON public.platform_settings
FOR DELETE
TO authenticated
USING ((SELECT is_admin()));

DROP POLICY IF EXISTS address_self ON public.delivery_addresses;

CREATE POLICY address_self_insert
ON public.delivery_addresses
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY address_self_update
ON public.delivery_addresses
FOR UPDATE
TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY address_self_delete
ON public.delivery_addresses
FOR DELETE
TO authenticated
USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS captains_read_available_order_items ON public.order_items;
DROP POLICY IF EXISTS order_items_relevant ON public.order_items;

CREATE POLICY order_items_select_relevant
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (
        o.customer_id = (SELECT auth.uid())
        OR o.captain_id = (SELECT auth.uid())
        OR (SELECT is_admin())
        OR EXISTS (
          SELECT 1
          FROM public.stores s
          WHERE s.id = o.store_id
            AND s.owner_id = (SELECT auth.uid())
        )
        OR (
          o.status = 'ready_for_pickup'::public.order_status
          AND o.captain_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.captains c ON c.user_id = ur.user_id
            WHERE ur.user_id = (SELECT auth.uid())
              AND ur.role = 'captain'::public.app_role
              AND ur.is_active = true
              AND c.is_online = true
          )
        )
      )
  )
);

DROP POLICY IF EXISTS users_read_own_order_history ON public.order_status_history;

DROP POLICY IF EXISTS captains_read_available_orders ON public.orders;
DROP POLICY IF EXISTS orders_relevant ON public.orders;

CREATE POLICY orders_select_relevant
ON public.orders
FOR SELECT
TO authenticated
USING (
  customer_id = (SELECT auth.uid())
  OR captain_id = (SELECT auth.uid())
  OR (SELECT is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = orders.store_id
      AND s.owner_id = (SELECT auth.uid())
  )
  OR (
    status = 'ready_for_pickup'::public.order_status
    AND captain_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.captains c ON c.user_id = ur.user_id
      WHERE ur.user_id = (SELECT auth.uid())
        AND ur.role = 'captain'::public.app_role
        AND ur.is_active = true
        AND c.is_online = true
    )
  )
);

DROP POLICY IF EXISTS products_manage_owner_vendor_admin ON public.products;
DROP POLICY IF EXISTS products_public ON public.products;

CREATE POLICY products_public
ON public.products
FOR SELECT
TO anon
USING (is_available = true);

CREATE POLICY products_authenticated_select
ON public.products
FOR SELECT
TO authenticated
USING (
  is_available = true
  OR
  (SELECT is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = products.store_id
      AND s.owner_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.is_active = true
          AND ur.role = ANY (
            ARRAY[
              'vendor'::public.app_role,
              'restaurant_vendor'::public.app_role,
              'supermarket_vendor'::public.app_role,
              'fashion_vendor'::public.app_role,
              'electronics_vendor'::public.app_role,
              'jewelry_vendor'::public.app_role
            ]
          )
      )
  )
);

CREATE POLICY products_manage_insert
ON public.products
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = products.store_id
      AND s.owner_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.is_active = true
          AND ur.role = ANY (
            ARRAY[
              'vendor'::public.app_role,
              'restaurant_vendor'::public.app_role,
              'supermarket_vendor'::public.app_role,
              'fashion_vendor'::public.app_role,
              'electronics_vendor'::public.app_role,
              'jewelry_vendor'::public.app_role
            ]
          )
      )
  )
);

CREATE POLICY products_manage_update
ON public.products
FOR UPDATE
TO authenticated
USING (
  (SELECT is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = products.store_id
      AND s.owner_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.is_active = true
          AND ur.role = ANY (
            ARRAY[
              'vendor'::public.app_role,
              'restaurant_vendor'::public.app_role,
              'supermarket_vendor'::app_role,
              'fashion_vendor'::app_role,
              'electronics_vendor'::app_role,
              'jewelry_vendor'::public.app_role
            ]
          )
      )
  )
)
WITH CHECK (
  (SELECT is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = products.store_id
      AND s.owner_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.is_active = true
          AND ur.role = ANY (
            ARRAY[
              'vendor'::public.app_role,
              'restaurant_vendor'::public.app_role,
              'supermarket_vendor'::public.app_role,
              'fashion_vendor'::public.app_role,
              'electronics_vendor'::public.app_role,
              'jewelry_vendor'::public.app_role
            ]
          )
      )
  )
);

CREATE POLICY products_manage_delete
ON public.products
FOR DELETE
TO authenticated
USING (
  (SELECT is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = products.store_id
      AND s.owner_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.is_active = true
          AND ur.role = ANY (
            ARRAY[
              'vendor'::public.app_role,
              'restaurant_vendor'::public.app_role,
              'supermarket_vendor'::public.app_role,
              'fashion_vendor'::public.app_role,
              'electronics_vendor'::public.app_role,
              'jewelry_vendor'::public.app_role
            ]
          )
      )
  )
);

DROP POLICY IF EXISTS promotions_owner_vendor_admin ON public.promotions;
DROP POLICY IF EXISTS promotions_public ON public.promotions;

CREATE POLICY promotions_public
ON public.promotions
FOR SELECT
TO anon
USING (is_active = true);

CREATE POLICY promotions_authenticated_select
ON public.promotions
FOR SELECT
TO authenticated
USING (
  is_active = true
  OR
  (SELECT is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = promotions.store_id
      AND s.owner_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.is_active = true
          AND ur.role = ANY (
            ARRAY[
              'vendor'::public.app_role,
              'restaurant_vendor'::public.app_role,
              'supermarket_vendor'::public.app_role,
              'fashion_vendor'::public.app_role,
              'electronics_vendor'::public.app_role,
              'jewelry_vendor'::public.app_role
            ]
          )
      )
  )
);

CREATE POLICY promotions_manage_insert
ON public.promotions
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = promotions.store_id
      AND s.owner_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.is_active = true
          AND ur.role = ANY (
            ARRAY[
              'vendor'::public.app_role,
              'restaurant_vendor'::public.app_role,
              'supermarket_vendor'::public.app_role,
              'fashion_vendor'::public.app_role,
              'electronics_vendor'::public.app_role,
              'jewelry_vendor'::public.app_role
            ]
          )
      )
  )
);

CREATE POLICY promotions_manage_update
ON public.promotions
FOR UPDATE
TO authenticated
USING (
  (SELECT is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = promotions.store_id
      AND s.owner_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.is_active = true
          AND ur.role = ANY (
            ARRAY[
              'vendor'::public.app_role,
              'restaurant_vendor'::public.app_role,
              'supermarket_vendor'::public.app_role,
              'fashion_vendor'::public.app_role,
              'electronics_vendor'::public.app_role,
              'jewelry_vendor'::public.app_role
            ]
          )
      )
  )
)
WITH CHECK (
  (SELECT is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = promotions.store_id
      AND s.owner_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.is_active = true
          AND ur.role = ANY (
            ARRAY[
              'vendor'::public.app_role,
              'restaurant_vendor'::public.app_role,
              'supermarket_vendor'::public.app_role,
              'fashion_vendor'::public.app_role,
              'electronics_vendor'::public.app_role,
              'jewelry_vendor'::public.app_role
            ]
          )
      )
  )
);

CREATE POLICY promotions_manage_delete
ON public.promotions
FOR DELETE
TO authenticated
USING (
  (SELECT is_admin())
  OR EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = promotions.store_id
      AND s.owner_id = (SELECT auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.is_active = true
          AND ur.role = ANY (
            ARRAY[
              'vendor'::public.app_role,
              'restaurant_vendor'::public.app_role,
              'supermarket_vendor'::public.app_role,
              'fashion_vendor'::public.app_role,
              'electronics_vendor'::public.app_role,
              'jewelry_vendor'::public.app_role
            ]
          )
      )
  )
);

DROP POLICY IF EXISTS umrah_settlements_admin_write ON public.umrah_company_settlements;

CREATE POLICY umrah_settlements_admin_insert
ON public.umrah_company_settlements
FOR INSERT
TO authenticated
WITH CHECK ((SELECT current_user_role()) = ANY (ARRAY['super_admin','admin']));

CREATE POLICY umrah_settlements_admin_update
ON public.umrah_company_settlements
FOR UPDATE
TO authenticated
USING ((SELECT current_user_role()) = ANY (ARRAY['super_admin','admin']))
WITH CHECK ((SELECT current_user_role()) = ANY (ARRAY['super_admin','admin']));

CREATE POLICY umrah_settlements_admin_delete
ON public.umrah_company_settlements
FOR DELETE
TO authenticated
USING ((SELECT current_user_role()) = ANY (ARRAY['super_admin','admin']));

COMMIT;
