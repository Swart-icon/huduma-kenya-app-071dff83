
-- Add coordinates to services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Add coordinates to provider_profiles
ALTER TABLE public.provider_profiles ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE public.provider_profiles ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Index for spatial queries
CREATE INDEX IF NOT EXISTS idx_services_coords ON public.services (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_provider_profiles_coords ON public.provider_profiles (latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
