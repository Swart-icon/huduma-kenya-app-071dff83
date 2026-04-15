
CREATE TABLE public.app_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  star_rating INTEGER NOT NULL CHECK (star_rating >= 1 AND star_rating <= 5),
  feedback_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own ratings"
ON public.app_ratings FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own ratings"
ON public.app_ratings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all ratings"
ON public.app_ratings FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));
