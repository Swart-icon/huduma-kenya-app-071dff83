
-- 1. profile_views table
CREATE TABLE IF NOT EXISTS public.profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_user_id uuid NOT NULL,
  viewer_id uuid NOT NULL,
  view_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_user_id, viewer_id, view_date)
);

CREATE INDEX IF NOT EXISTS idx_profile_views_owner ON public.profile_views(profile_user_id, created_at DESC);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own profile views"
  ON public.profile_views FOR SELECT
  USING (auth.uid() = profile_user_id);

CREATE POLICY "Admins view all profile views"
  ON public.profile_views FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can record a view"
  ON public.profile_views FOR INSERT
  WITH CHECK (auth.uid() = viewer_id AND auth.uid() <> profile_user_id);

-- 2. Trigger: notify on video like
CREATE OR REPLACE FUNCTION public.notify_on_video_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
  liker_name text;
  v_title text;
BEGIN
  SELECT user_id, COALESCE(NULLIF(title, ''), 'your video')
    INTO owner_id, v_title
  FROM public.videos WHERE id = NEW.video_id;

  IF owner_id IS NULL OR owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Throttle: skip if the same liker already triggered a like notification for this owner in the past hour
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = owner_id
      AND type = 'video_like'
      AND reference_id = NEW.user_id
      AND created_at > now() - interval '1 hour'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), 'Someone')
    INTO liker_name
  FROM public.profiles WHERE user_id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, reference_id)
  VALUES (
    owner_id,
    'video_like',
    'New like on your video',
    COALESCE(liker_name, 'Someone') || ' liked ' || v_title,
    NEW.user_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_video_like ON public.video_likes;
CREATE TRIGGER notify_video_like
  AFTER INSERT ON public.video_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_video_like();

-- 3. Trigger: notify on video comment
CREATE OR REPLACE FUNCTION public.notify_on_video_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
  commenter_name text;
  v_title text;
BEGIN
  SELECT user_id, COALESCE(NULLIF(title, ''), 'your video')
    INTO owner_id, v_title
  FROM public.videos WHERE id = NEW.video_id;

  IF owner_id IS NULL OR owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), 'Someone')
    INTO commenter_name
  FROM public.profiles WHERE user_id = NEW.user_id;

  INSERT INTO public.notifications (user_id, type, title, body, reference_id)
  VALUES (
    owner_id,
    'video_comment',
    'New comment on your video',
    COALESCE(commenter_name, 'Someone') || ' commented: ' || LEFT(NEW.content, 100),
    NEW.video_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_video_comment ON public.video_comments;
CREATE TRIGGER notify_video_comment
  AFTER INSERT ON public.video_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_video_comment();

-- 4. Trigger: notify on profile view (only fires when a NEW row is inserted — uniqueness handles dedup per day)
CREATE OR REPLACE FUNCTION public.notify_on_profile_view()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_name text;
BEGIN
  IF NEW.viewer_id = NEW.profile_user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(full_name, ''), 'Someone')
    INTO viewer_name
  FROM public.profiles WHERE user_id = NEW.viewer_id;

  INSERT INTO public.notifications (user_id, type, title, body, reference_id)
  VALUES (
    NEW.profile_user_id,
    'profile_view',
    'Someone viewed your profile',
    COALESCE(viewer_name, 'Someone') || ' viewed your profile',
    NEW.viewer_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_profile_view ON public.profile_views;
CREATE TRIGGER notify_profile_view
  AFTER INSERT ON public.profile_views
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_profile_view();
