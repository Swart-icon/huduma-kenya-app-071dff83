-- Replace the fully-public SELECT policy with an authenticated-only one
DROP POLICY IF EXISTS "Provider profiles are viewable by everyone" ON public.provider_profiles;

CREATE POLICY "Authenticated users can view provider profiles"
ON public.provider_profiles
FOR SELECT
TO authenticated
USING (true);