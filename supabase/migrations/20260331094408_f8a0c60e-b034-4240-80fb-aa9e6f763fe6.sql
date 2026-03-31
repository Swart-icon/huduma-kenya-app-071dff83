
-- Create service categories table
CREATE TABLE public.service_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS (public read, no public write)
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Categories are viewable by everyone"
  ON public.service_categories FOR SELECT
  USING (true);

-- Create services table
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12,2),
  price_type TEXT NOT NULL DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'negotiable', 'starting_from')),
  city TEXT,
  county TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Anyone can view active services
CREATE POLICY "Active services are viewable by everyone"
  ON public.services FOR SELECT
  USING (is_active = true);

-- Providers can view all their own services (including inactive)
CREATE POLICY "Providers can view all own services"
  ON public.services FOR SELECT
  USING (auth.uid() = provider_id);

-- Only providers can create services (enforced via provider_id = auth.uid())
CREATE POLICY "Providers can create their own services"
  ON public.services FOR INSERT
  WITH CHECK (auth.uid() = provider_id);

-- Only owner can update
CREATE POLICY "Providers can update their own services"
  ON public.services FOR UPDATE
  USING (auth.uid() = provider_id);

-- Only owner can delete
CREATE POLICY "Providers can delete their own services"
  ON public.services FOR DELETE
  USING (auth.uid() = provider_id);

-- Timestamp trigger for services
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed categories
INSERT INTO public.service_categories (name, slug, icon, sort_order) VALUES
  ('Construction', 'construction', '🏗️', 1),
  ('Automotive', 'automotive', '🚗', 2),
  ('Electronics', 'electronics', '🔌', 3),
  ('IT Services', 'it-services', '💻', 4),
  ('Home Services', 'home-services', '🏠', 5),
  ('Business Services', 'business-services', '💼', 6),
  ('Education', 'education', '📚', 7),
  ('Health & Wellness', 'health-wellness', '🏥', 8),
  ('Hospitality', 'hospitality', '🍽️', 9),
  ('Security & Logistics', 'security-logistics', '🔒', 10),
  ('Agriculture', 'agriculture', '🌾', 11),
  ('Beauty & Lifestyle', 'beauty-lifestyle', '💅', 12),
  ('Media & Creative', 'media-creative', '🎬', 13),
  ('Transport', 'transport', '🚚', 14),
  ('Retail & Trade', 'retail-trade', '🛒', 15);
