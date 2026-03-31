
-- Allow admins to insert roles for other users
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin')
  );

-- Allow admins to view all roles
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin')
  );

-- Allow admins to delete roles
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE USING (
    public.has_role(auth.uid(), 'admin')
  );
