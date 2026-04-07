-- Backfill coordinates for existing providers based on county
-- Meru county -> Meru city coordinates (0.0480, 37.6559)
UPDATE public.provider_profiles
SET latitude = 0.0480, longitude = 37.6559
WHERE county = 'Meru' AND latitude IS NULL AND longitude IS NULL;