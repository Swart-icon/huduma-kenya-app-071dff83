-- Create the increment_view_count function
CREATE OR REPLACE FUNCTION public.increment_view_count(status_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE provider_statuses
  SET view_count = view_count + 1
  WHERE id = status_id
    AND expires_at > now();
$$;

-- Allow authenticated users to update view_count on provider_statuses
CREATE POLICY "Authenticated users can update view count"
ON public.provider_statuses
FOR UPDATE
TO authenticated
USING (expires_at > now())
WITH CHECK (expires_at > now());
