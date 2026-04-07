
-- Create videos table
CREATE TABLE public.videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  category_id UUID REFERENCES public.service_categories(id),
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Everyone can view active videos
CREATE POLICY "Anyone can view active videos"
ON public.videos FOR SELECT
USING (status = 'active');

-- Admins can view all videos
CREATE POLICY "Admins can view all videos"
ON public.videos FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Only providers and job seekers can upload videos
CREATE POLICY "Providers can upload videos"
ON public.videos FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (public.has_role(auth.uid(), 'provider') OR public.has_role(auth.uid(), 'job_seeker'))
);

-- Owners can update their own videos
CREATE POLICY "Owners can update own videos"
ON public.videos FOR UPDATE
USING (auth.uid() = user_id);

-- Owners can delete their own videos
CREATE POLICY "Owners can delete own videos"
ON public.videos FOR DELETE
USING (auth.uid() = user_id);

-- Admins can delete any video
CREATE POLICY "Admins can delete any video"
ON public.videos FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Timestamp trigger
CREATE TRIGGER update_videos_updated_at
BEFORE UPDATE ON public.videos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-videos', 'user-videos', true);

-- Storage policies for video uploads
CREATE POLICY "Anyone can view videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-videos');

CREATE POLICY "Authenticated users can upload videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'user-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'user-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable realtime for videos
ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;
