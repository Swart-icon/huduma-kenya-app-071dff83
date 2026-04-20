DROP POLICY IF EXISTS "Authenticated users can update view count" ON public.provider_statuses;

CREATE POLICY "Owners can update own statuses"
ON public.provider_statuses
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);