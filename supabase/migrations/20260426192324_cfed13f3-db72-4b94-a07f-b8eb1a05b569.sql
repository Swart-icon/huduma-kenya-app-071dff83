-- Tighten: providers can only INSERT a service if they have an active
-- provider premium subscription (verified server-side, not from frontend).
DROP POLICY IF EXISTS "Providers can create their own services" ON public.services;

CREATE POLICY "Premium providers can create their own services"
ON public.services
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = provider_id
  AND EXISTS (
    SELECT 1 FROM public.premium_subscriptions ps
    WHERE ps.user_id = auth.uid()
      AND ps.role_type = 'provider'
      AND ps.status = 'active'
      AND ps.expires_at IS NOT NULL
      AND ps.expires_at > now()
  )
);