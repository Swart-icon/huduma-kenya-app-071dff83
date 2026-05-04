
CREATE OR REPLACE FUNCTION public.public_provider_map_points()
RETURNS TABLE (
  user_id UUID,
  business_name TEXT,
  city TEXT,
  county TEXT,
  profile_image_url TEXT,
  is_verified BOOLEAN,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pp.user_id,
    pp.business_name,
    pp.city,
    pp.county,
    pp.profile_image_url,
    COALESCE(pp.is_verified, false) AS is_verified,
    -- Round to 2 decimal places (~1.1km precision) — enough for a map pin, not enough to find someone's house
    ROUND(ppp.latitude::NUMERIC, 2)::DOUBLE PRECISION AS latitude,
    ROUND(ppp.longitude::NUMERIC, 2)::DOUBLE PRECISION AS longitude
  FROM public.provider_profiles pp
  JOIN public.provider_profiles_private ppp ON ppp.user_id = pp.user_id
  WHERE ppp.latitude IS NOT NULL
    AND ppp.longitude IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.public_provider_map_points() FROM anon;
GRANT EXECUTE ON FUNCTION public.public_provider_map_points() TO authenticated;

-- Also restrict get_user_contact to authenticated only
REVOKE ALL ON FUNCTION public.get_user_contact(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_contact(UUID) TO authenticated;
