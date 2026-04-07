
CREATE OR REPLACE FUNCTION public.nearby_services(
  _lat DOUBLE PRECISION,
  _lng DOUBLE PRECISION,
  _radius_km DOUBLE PRECISION DEFAULT 10,
  _category_id UUID DEFAULT NULL,
  _min_rating DOUBLE PRECISION DEFAULT 0,
  _limit_count INTEGER DEFAULT 50,
  _offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  service_id UUID,
  title TEXT,
  description TEXT,
  price NUMERIC,
  price_type TEXT,
  city TEXT,
  county TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  category_id UUID,
  category_name TEXT,
  category_icon TEXT,
  provider_id UUID,
  business_name TEXT,
  is_verified BOOLEAN,
  profile_image_url TEXT,
  avg_rating DOUBLE PRECISION,
  review_count BIGINT,
  distance_km DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    s.id AS service_id,
    s.title,
    s.description,
    s.price,
    s.price_type,
    s.city,
    s.county,
    s.latitude,
    s.longitude,
    s.category_id,
    sc.name AS category_name,
    sc.icon AS category_icon,
    s.provider_id,
    pp.business_name,
    COALESCE(pp.is_verified, false) AS is_verified,
    pp.profile_image_url,
    COALESCE(r_agg.avg_rating, 0) AS avg_rating,
    COALESCE(r_agg.review_count, 0) AS review_count,
    (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(_lat)) * cos(radians(s.latitude)) *
          cos(radians(s.longitude) - radians(_lng)) +
          sin(radians(_lat)) * sin(radians(s.latitude))
        ))
      )
    ) AS distance_km
  FROM public.services s
  JOIN public.service_categories sc ON sc.id = s.category_id
  LEFT JOIN public.provider_profiles pp ON pp.user_id = s.provider_id
  LEFT JOIN LATERAL (
    SELECT
      AVG(rv.rating)::DOUBLE PRECISION AS avg_rating,
      COUNT(*)::BIGINT AS review_count
    FROM public.reviews rv
    WHERE rv.provider_id = s.provider_id
  ) r_agg ON true
  WHERE s.is_active = true
    AND s.latitude IS NOT NULL
    AND s.longitude IS NOT NULL
    AND (_category_id IS NULL OR s.category_id = _category_id)
    AND COALESCE(r_agg.avg_rating, 0) >= _min_rating
    AND (
      6371 * acos(
        LEAST(1.0, GREATEST(-1.0,
          cos(radians(_lat)) * cos(radians(s.latitude)) *
          cos(radians(s.longitude) - radians(_lng)) +
          sin(radians(_lat)) * sin(radians(s.latitude))
        ))
      )
    ) <= _radius_km
  ORDER BY distance_km ASC
  LIMIT _limit_count
  OFFSET _offset_count
$$;
