-- Provider statuses (stories)
CREATE TABLE public.provider_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  image_url TEXT,
  text_content TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours')
);

ALTER TABLE public.provider_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view non-expired statuses"
  ON public.provider_statuses FOR SELECT
  USING (expires_at > now());

CREATE POLICY "Providers can create statuses"
  ON public.provider_statuses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Providers can delete own statuses"
  ON public.provider_statuses FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_provider_statuses_user ON public.provider_statuses (user_id);
CREATE INDEX idx_provider_statuses_expires ON public.provider_statuses (expires_at);

-- Status likes
CREATE TABLE public.status_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_id UUID NOT NULL REFERENCES public.provider_statuses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(status_id, user_id)
);

ALTER TABLE public.status_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view likes"
  ON public.status_likes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can like statuses"
  ON public.status_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike"
  ON public.status_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Status replies
CREATE TABLE public.status_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_id UUID NOT NULL REFERENCES public.provider_statuses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.status_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view replies"
  ON public.status_replies FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can reply to statuses"
  ON public.status_replies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own replies"
  ON public.status_replies FOR DELETE
  USING (auth.uid() = user_id);