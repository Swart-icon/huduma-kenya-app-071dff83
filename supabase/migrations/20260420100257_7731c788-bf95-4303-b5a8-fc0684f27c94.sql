-- Remove the unsafe self-assignment policies
DROP POLICY IF EXISTS "Users can insert their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can delete their own roles" ON public.user_roles;

-- Secure helper: lets a user assign themselves a non-admin role (used during signup / role selection)
CREATE OR REPLACE FUNCTION public.assign_self_role(_role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _role = 'admin' THEN
    RAISE EXCEPTION 'Cannot self-assign admin role';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), _role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

-- Secure helper: lets a user remove a non-admin role from themselves
CREATE OR REPLACE FUNCTION public.remove_self_role(_role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _role = 'admin' THEN
    RAISE EXCEPTION 'Cannot self-remove admin role';
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = auth.uid()
    AND role = _role;
END;
$$;