CREATE TYPE public.app_role AS ENUM ('admin', 'operario');
CREATE TYPE public.work_order_status AS ENUM ('pendiente', 'en_curso', 'pausada', 'finalizada');
CREATE TYPE public.work_order_priority AS ENUM ('baja', 'media', 'alta');
CREATE TYPE public.photo_kind AS ENUM ('antes', 'despues');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name TEXT NOT NULL,
  address TEXT NOT NULL,
  contact_phone TEXT,
  description TEXT NOT NULL,
  priority public.work_order_priority NOT NULL DEFAULT 'media',
  status public.work_order_status NOT NULL DEFAULT 'pendiente',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closing_note TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX work_orders_assigned_idx ON public.work_orders (assigned_to, scheduled_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "work_orders_select" ON public.work_orders FOR SELECT TO authenticated
  USING (assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "work_orders_update" ON public.work_orders FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "work_orders_insert_admin" ON public.work_orders FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "work_orders_delete_admin" ON public.work_orders FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.work_order_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  status public.work_order_status NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX work_order_status_events_order_idx ON public.work_order_status_events (work_order_id, created_at);
GRANT SELECT, INSERT ON public.work_order_status_events TO authenticated;
GRANT ALL ON public.work_order_status_events TO service_role;
ALTER TABLE public.work_order_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status_events_select" ON public.work_order_status_events FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.work_orders o WHERE o.id = work_order_id AND o.assigned_to = auth.uid())
  );
CREATE POLICY "status_events_insert" ON public.work_order_status_events FOR INSERT TO authenticated
  WITH CHECK (
    changed_by = auth.uid() AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.work_orders o WHERE o.id = work_order_id AND o.assigned_to = auth.uid())
    )
  );

CREATE TABLE public.work_order_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  kind public.photo_kind NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX work_order_photos_order_idx ON public.work_order_photos (work_order_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.work_order_photos TO authenticated;
GRANT ALL ON public.work_order_photos TO service_role;
ALTER TABLE public.work_order_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos_select" ON public.work_order_photos FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.work_orders o WHERE o.id = work_order_id AND o.assigned_to = auth.uid())
  );
CREATE POLICY "photos_insert" ON public.work_order_photos FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid() AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.work_orders o WHERE o.id = work_order_id AND o.assigned_to = auth.uid())
    )
  );
CREATE POLICY "photos_delete" ON public.work_order_photos FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.work_orders o WHERE o.id = work_order_id AND o.assigned_to = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER work_orders_touch_updated_at BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.work_orders (client_name, address, contact_phone, description, priority, scheduled_at) VALUES
  ('Comunidad Los Olivos', 'Calle Mayor 24, 28013 Madrid', '+34 611 223 344', 'Fuga de agua en el cuarto de contadores del sótano. Acceso por portal principal.', 'alta', now() + interval '2 hours'),
  ('Hotel Rivera', 'Paseo Marítimo 8, 29016 Málaga', '+34 622 334 455', 'Climatización de la planta 3 no enfría. Revisar split de habitaciones 301-310.', 'media', now() + interval '5 hours'),
  ('Oficinas Delta', 'Av. Diagonal 402, 08037 Barcelona', '+34 633 445 566', 'Sustitución de 6 luminarias LED en sala de reuniones.', 'baja', now() + interval '1 day'),
  ('Residencia El Pinar', 'Camino del Pinar 15, 41013 Sevilla', '+34 644 556 677', 'Puerta automática del garaje bloqueada. Urgente, vecinos sin acceso.', 'alta', now() + interval '1 day 3 hours'),
  ('Gimnasio Forma', 'Calle Industria 77, 46022 Valencia', '+34 655 667 788', 'Mantenimiento preventivo trimestral de caldera y ACS.', 'media', now() + interval '2 days');