
-- ============================================================================
-- 1. Create private sibling tables for PII
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles_private (
  user_id UUID PRIMARY KEY,
  phone TEXT,
  area TEXT,
  location TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.provider_profiles_private (
  user_id UUID PRIMARY KEY,
  contact_phone TEXT,
  contact_email TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. Backfill from existing tables (idempotent)
-- ============================================================================
INSERT INTO public.profiles_private (user_id, phone, area, location, latitude, longitude)
SELECT user_id, phone, area, location, latitude, longitude
FROM public.profiles
WHERE user_id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
SET phone = EXCLUDED.phone,
    area = EXCLUDED.area,
    location = EXCLUDED.location,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude;

INSERT INTO public.provider_profiles_private (user_id, contact_phone, contact_email, latitude, longitude)
SELECT user_id, contact_phone, contact_email, latitude, longitude
FROM public.provider_profiles
WHERE user_id IS NOT NULL
ON CONFLICT (user_id) DO UPDATE
SET contact_phone = EXCLUDED.contact_phone,
    contact_email = EXCLUDED.contact_email,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude;

-- ============================================================================
-- 3. Drop sensitive columns from public tables
-- ============================================================================
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS area,
  DROP COLUMN IF EXISTS location,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude;

ALTER TABLE public.provider_profiles
  DROP COLUMN IF EXISTS contact_phone,
  DROP COLUMN IF EXISTS contact_email,
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude;

-- ============================================================================
-- 4. RLS for private tables — owner + admin only
-- ============================================================================
ALTER TABLE public.profiles_private ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_profiles_private ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view own private profile" ON public.profiles_private;
CREATE POLICY "Owners can view own private profile"
  ON public.profiles_private FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all private profiles" ON public.profiles_private;
CREATE POLICY "Admins can view all private profiles"
  ON public.profiles_private FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Owners can insert own private profile" ON public.profiles_private;
CREATE POLICY "Owners can insert own private profile"
  ON public.profiles_private FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners can update own private profile" ON public.profiles_private;
CREATE POLICY "Owners can update own private profile"
  ON public.profiles_private FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners can view own provider private" ON public.provider_profiles_private;
CREATE POLICY "Owners can view own provider private"
  ON public.provider_profiles_private FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all provider private" ON public.provider_profiles_private;
CREATE POLICY "Admins can view all provider private"
  ON public.provider_profiles_private FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Owners can insert own provider private" ON public.provider_profiles_private;
CREATE POLICY "Owners can insert own provider private"
  ON public.provider_profiles_private FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owners can update own provider private" ON public.provider_profiles_private;
CREATE POLICY "Owners can update own provider private"
  ON public.provider_profiles_private FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 5. Auto-create private rows on profile creation
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_profile_private()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles_private (user_id) VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_profile_private ON public.profiles;
CREATE TRIGGER trg_ensure_profile_private
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_profile_private();

CREATE OR REPLACE FUNCTION public.ensure_provider_private()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.provider_profiles_private (user_id) VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_provider_private ON public.provider_profiles;
CREATE TRIGGER trg_ensure_provider_private
AFTER INSERT ON public.provider_profiles
FOR EACH ROW EXECUTE FUNCTION public.ensure_provider_private();

-- ============================================================================
-- 6. Contact-reveal RPC for booking parties
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_contact(_user_id UUID)
RETURNS TABLE (phone TEXT, contact_phone TEXT, contact_email TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Allow if: caller is the user themselves, admin, or has a booking with them
  IF auth.uid() = _user_id
     OR public.has_role(auth.uid(), 'admin'::app_role)
     OR EXISTS (
       SELECT 1 FROM public.bookings b
       WHERE (
         (b.client_id = auth.uid() AND b.provider_id = _user_id)
         OR (b.provider_id = auth.uid() AND b.client_id = _user_id)
       )
       AND b.status IN ('confirmed', 'in_progress', 'completed')
     )
  THEN
    RETURN QUERY
      SELECT pp.phone, ppp.contact_phone, ppp.contact_email
      FROM public.profiles_private pp
      FULL OUTER JOIN public.provider_profiles_private ppp ON ppp.user_id = pp.user_id
      WHERE COALESCE(pp.user_id, ppp.user_id) = _user_id;
  ELSE
    -- Return empty (not an error — caller just isn't authorized)
    RETURN;
  END IF;
END;
$$;

-- ============================================================================
-- 7. Lock down job-seeker-docs storage bucket
-- ============================================================================
UPDATE storage.buckets SET public = false WHERE id = 'job-seeker-docs';

DROP POLICY IF EXISTS "Job seekers can upload own docs" ON storage.objects;
CREATE POLICY "Job seekers can upload own docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'job-seeker-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Job seekers can update own docs" ON storage.objects;
CREATE POLICY "Job seekers can update own docs"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'job-seeker-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Job seekers can delete own docs" ON storage.objects;
CREATE POLICY "Job seekers can delete own docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'job-seeker-docs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Owners and employers can read job-seeker docs" ON storage.objects;
CREATE POLICY "Owners and employers can read job-seeker docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'job-seeker-docs'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.job_applications ja
        JOIN public.job_posts jp ON jp.id = ja.job_post_id
        WHERE ja.applicant_id::text = (storage.foldername(name))[1]
          AND jp.client_id = auth.uid()
      )
    )
  );
