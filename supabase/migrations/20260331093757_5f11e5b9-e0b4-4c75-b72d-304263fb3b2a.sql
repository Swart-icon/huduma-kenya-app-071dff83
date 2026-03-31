
-- Create provider_profiles table
CREATE TABLE public.provider_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  description TEXT,
  city TEXT,
  county TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  profile_image_url TEXT,
  availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'offline')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.provider_profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can view provider profiles (clients need to browse them)
CREATE POLICY "Provider profiles are viewable by everyone"
  ON public.provider_profiles FOR SELECT
  USING (true);

-- Only the owner can insert their profile
CREATE POLICY "Providers can create their own profile"
  ON public.provider_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only the owner can update their profile
CREATE POLICY "Providers can update their own profile"
  ON public.provider_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Only the owner can delete their profile
CREATE POLICY "Providers can delete their own profile"
  ON public.provider_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_provider_profiles_updated_at
  BEFORE UPDATE ON public.provider_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for provider profile images
INSERT INTO storage.buckets (id, name, public) VALUES ('provider-images', 'provider-images', true);

-- Storage policies
CREATE POLICY "Provider images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'provider-images');

CREATE POLICY "Providers can upload their own images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'provider-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Providers can update their own images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'provider-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Providers can delete their own images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'provider-images' AND auth.uid()::text = (storage.foldername(name))[1]);
