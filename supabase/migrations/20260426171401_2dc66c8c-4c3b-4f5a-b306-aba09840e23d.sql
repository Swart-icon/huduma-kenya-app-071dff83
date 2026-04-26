ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'Kenya',
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Public-facing approximate location (city + county only, no precise coords/area).
-- Precise lat/lng + area remain in the table but RLS already restricts updates to owner.
-- For public display, the app should only render city + county.