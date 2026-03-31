
-- Add new columns to provider_profiles
ALTER TABLE public.provider_profiles
  ADD COLUMN IF NOT EXISTS years_experience integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS skills text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_radius_km integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

-- Provider verification requests
CREATE TABLE public.provider_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_type text NOT NULL, -- 'national_id', 'business_license', 'certificate'
  document_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.provider_verifications ENABLE ROW LEVEL SECURITY;

-- Providers can view and create their own verifications
CREATE POLICY "Providers can view own verifications" ON public.provider_verifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Providers can submit verifications" ON public.provider_verifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all and update
CREATE POLICY "Admins can view all verifications" ON public.provider_verifications
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update verifications" ON public.provider_verifications
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Portfolio items
CREATE TABLE public.portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  image_url text NOT NULL,
  title text NOT NULL DEFAULT '',
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portfolio items are viewable by everyone" ON public.portfolio_items
  FOR SELECT USING (true);

CREATE POLICY "Providers can manage own portfolio" ON public.portfolio_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Providers can update own portfolio" ON public.portfolio_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Providers can delete own portfolio" ON public.portfolio_items
  FOR DELETE USING (auth.uid() = user_id);

-- Provider availability schedule
CREATE TABLE public.provider_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sun, 6=Sat
  start_time time NOT NULL DEFAULT '09:00',
  end_time time NOT NULL DEFAULT '17:00',
  is_available boolean NOT NULL DEFAULT true,
  UNIQUE (user_id, day_of_week)
);

ALTER TABLE public.provider_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Availability is viewable by everyone" ON public.provider_availability
  FOR SELECT USING (true);

CREATE POLICY "Providers can manage own availability" ON public.provider_availability
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage bucket for portfolio images
INSERT INTO storage.buckets (id, name, public) VALUES ('portfolio-images', 'portfolio-images', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage bucket for verification documents (NOT public)
INSERT INTO storage.buckets (id, name, public) VALUES ('verification-docs', 'verification-docs', false)
  ON CONFLICT (id) DO NOTHING;

-- Storage RLS for portfolio-images
CREATE POLICY "Anyone can view portfolio images" ON storage.objects
  FOR SELECT USING (bucket_id = 'portfolio-images');

CREATE POLICY "Providers can upload portfolio images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'portfolio-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Providers can delete own portfolio images" ON storage.objects
  FOR DELETE USING (bucket_id = 'portfolio-images' AND auth.uid() IS NOT NULL);

-- Storage RLS for verification-docs
CREATE POLICY "Providers can upload verification docs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'verification-docs' AND auth.uid() IS NOT NULL);

CREATE POLICY "Providers can view own verification docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'verification-docs' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all verification docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'verification-docs' AND public.has_role(auth.uid(), 'admin'));
