-- Region-based content ranking RPCs
-- Priority: same city (0) → same county (1) → national (2)
-- Each function returns content with a `location_rank` and orders by it.

-- ============================================
-- 1. Ranked Videos
-- ============================================
CREATE OR REPLACE FUNCTION public.ranked_videos(
  _user_city text DEFAULT NULL,
  _user_county text DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _limit_count integer DEFAULT 20,
  _offset_count integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  title text,
  video_url text,
  thumbnail_url text,
  duration_seconds integer,
  view_count integer,
  like_count integer,
  comment_count integer,
  category_id uuid,
  city text,
  county text,
  created_at timestamptz,
  location_rank integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.user_id,
    v.title,
    v.video_url,
    v.thumbnail_url,
    v.duration_seconds,
    v.view_count,
    v.like_count,
    v.comment_count,
    v.category_id,
    v.city,
    v.county,
    v.created_at,
    CASE
      WHEN _user_city IS NOT NULL AND lower(v.city) = lower(_user_city) THEN 0
      WHEN _user_county IS NOT NULL AND lower(v.county) = lower(_user_county) THEN 1
      ELSE 2
    END AS location_rank
  FROM public.videos v
  WHERE v.status = 'active'
    AND (_category_id IS NULL OR v.category_id = _category_id)
  ORDER BY location_rank ASC, v.created_at DESC
  LIMIT _limit_count
  OFFSET _offset_count;
$$;

-- ============================================
-- 2. Ranked Services
-- ============================================
CREATE OR REPLACE FUNCTION public.ranked_services(
  _user_city text DEFAULT NULL,
  _user_county text DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _limit_count integer DEFAULT 20,
  _offset_count integer DEFAULT 0
)
RETURNS TABLE (
  service_id uuid,
  title text,
  description text,
  price numeric,
  price_type text,
  city text,
  county text,
  category_id uuid,
  category_name text,
  category_icon text,
  provider_id uuid,
  business_name text,
  is_verified boolean,
  profile_image_url text,
  created_at timestamptz,
  location_rank integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
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
    s.category_id,
    sc.name AS category_name,
    sc.icon AS category_icon,
    s.provider_id,
    pp.business_name,
    pp.is_verified,
    pp.profile_image_url,
    s.created_at,
    CASE
      WHEN _user_city IS NOT NULL AND lower(s.city) = lower(_user_city) THEN 0
      WHEN _user_county IS NOT NULL AND lower(s.county) = lower(_user_county) THEN 1
      ELSE 2
    END AS location_rank
  FROM public.services s
  JOIN public.service_categories sc ON sc.id = s.category_id
  LEFT JOIN public.provider_profiles pp ON pp.user_id = s.provider_id
  WHERE s.is_active = true
    AND (_category_id IS NULL OR s.category_id = _category_id)
  ORDER BY location_rank ASC, s.created_at DESC
  LIMIT _limit_count
  OFFSET _offset_count;
$$;

-- ============================================
-- 3. Ranked Jobs
-- ============================================
CREATE OR REPLACE FUNCTION public.ranked_jobs(
  _user_city text DEFAULT NULL,
  _user_county text DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _limit_count integer DEFAULT 20,
  _offset_count integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  client_id uuid,
  title text,
  description text,
  budget numeric,
  budget_type text,
  city text,
  county text,
  category_id uuid,
  category_name text,
  category_icon text,
  status text,
  created_at timestamptz,
  location_rank integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jp.id,
    jp.client_id,
    jp.title,
    jp.description,
    jp.budget,
    jp.budget_type,
    jp.city,
    jp.county,
    jp.category_id,
    sc.name AS category_name,
    sc.icon AS category_icon,
    jp.status,
    jp.created_at,
    CASE
      WHEN _user_city IS NOT NULL AND lower(jp.city) = lower(_user_city) THEN 0
      WHEN _user_county IS NOT NULL AND lower(jp.county) = lower(_user_county) THEN 1
      ELSE 2
    END AS location_rank
  FROM public.job_posts jp
  JOIN public.service_categories sc ON sc.id = jp.category_id
  WHERE jp.status = 'open'
    AND (_category_id IS NULL OR jp.category_id = _category_id)
  ORDER BY location_rank ASC, jp.created_at DESC
  LIMIT _limit_count
  OFFSET _offset_count;
$$;

-- ============================================
-- Indexes for fast location filtering
-- ============================================
CREATE INDEX IF NOT EXISTS idx_videos_city_lower ON public.videos (lower(city)) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_videos_county_lower ON public.videos (lower(county)) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_services_city_lower ON public.services (lower(city)) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_services_county_lower ON public.services (lower(county)) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_job_posts_city_lower ON public.job_posts (lower(city)) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_job_posts_county_lower ON public.job_posts (lower(county)) WHERE status = 'open';