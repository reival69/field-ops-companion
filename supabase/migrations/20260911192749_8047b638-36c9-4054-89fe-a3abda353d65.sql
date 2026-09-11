-- 1. Move the SECURITY DEFINER role-check helper out of the exposed API schema
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

ALTER FUNCTION public.has_role(UUID, public.app_role) SET SCHEMA private;
ALTER FUNCTION private.has_role(UUID, public.app_role) SET search_path = public;
REVOKE ALL ON FUNCTION private.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(UUID, public.app_role) TO authenticated, service_role;

-- 2. Role writes: admin only (was: no write policies at all)
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

CREATE POLICY user_roles_insert_admin ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY user_roles_update_admin ON public.user_roles
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

CREATE POLICY user_roles_delete_admin ON public.user_roles
  FOR DELETE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'));

-- 3. Storage policies for the private work-order-photos bucket
DROP POLICY IF EXISTS wop_select ON storage.objects;
DROP POLICY IF EXISTS wop_insert ON storage.objects;
DROP POLICY IF EXISTS wop_update ON storage.objects;
DROP POLICY IF EXISTS wop_delete ON storage.objects;

CREATE POLICY wop_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'work-order-photos'
    AND (
      private.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.work_order_photos p
        JOIN public.work_orders o ON o.id = p.work_order_id
        WHERE p.storage_path = storage.objects.name
          AND o.assigned_to = auth.uid()
      )
      OR owner = auth.uid()
    )
  );

CREATE POLICY wop_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'work-order-photos'
    AND owner = auth.uid()
    AND (
      private.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.work_orders o
        WHERE o.assigned_to = auth.uid()
      )
    )
  );

CREATE POLICY wop_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'work-order-photos'
    AND (private.has_role(auth.uid(), 'admin') OR owner = auth.uid())
  )
  WITH CHECK (
    bucket_id = 'work-order-photos'
    AND (private.has_role(auth.uid(), 'admin') OR owner = auth.uid())
  );

CREATE POLICY wop_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'work-order-photos'
    AND (
      private.has_role(auth.uid(), 'admin')
      OR owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.work_order_photos p
        JOIN public.work_orders o ON o.id = p.work_order_id
        WHERE p.storage_path = storage.objects.name
          AND o.assigned_to = auth.uid()
      )
    )
  );