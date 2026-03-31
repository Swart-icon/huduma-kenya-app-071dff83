
-- Admin can view all services
CREATE POLICY "Admins can view all services" ON public.services
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admin can update services (approve/deactivate)
CREATE POLICY "Admins can update all services" ON public.services
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Admin can delete services
CREATE POLICY "Admins can delete any service" ON public.services
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Admin can view all bookings
CREATE POLICY "Admins can view all bookings" ON public.bookings
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admin can view all payments
CREATE POLICY "Admins can view all payments" ON public.payments
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admin can view all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Admin can view all provider profiles
CREATE POLICY "Admins can view all provider profiles" ON public.provider_profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to insert notifications (for system notifications)
CREATE POLICY "Admins can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
