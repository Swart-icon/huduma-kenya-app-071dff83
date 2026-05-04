-- Allow anonymous (guest) users to read public content by ensuring the
-- has_role() function used in RLS policies is callable without auth.
-- Without EXECUTE, any policy referencing has_role() fails for anon, which
-- broke the public TikTok-style video feed for guests.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;