CREATE TABLE IF NOT EXISTS public.status_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_id UUID NOT NULL REFERENCES public.provider_statuses(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (status_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_status_views_status_id ON public.status_views(status_id);
CREATE INDEX IF NOT EXISTS idx_status_views_viewer_id ON public.status_views(viewer_id);

ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can record own story views" ON public.status_views;
CREATE POLICY "Users can record own story views"
ON public.status_views
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = viewer_id);

DROP POLICY IF EXISTS "Story owners can view viewer records" ON public.status_views;
CREATE POLICY "Story owners can view viewer records"
ON public.status_views
FOR SELECT
TO authenticated
USING (
  auth.uid() = viewer_id
  OR EXISTS (
    SELECT 1
    FROM public.provider_statuses ps
    WHERE ps.id = status_id
      AND ps.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.increment_view_count(status_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_viewer UUID;
  inserted_rows INTEGER := 0;
BEGIN
  current_viewer := auth.uid();

  IF current_viewer IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.provider_statuses ps
    WHERE ps.id = status_id
      AND (ps.user_id = current_viewer OR ps.expires_at <= now())
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.status_views (status_id, viewer_id)
  VALUES (status_id, current_viewer)
  ON CONFLICT (status_id, viewer_id) DO NOTHING;

  GET DIAGNOSTICS inserted_rows = ROW_COUNT;

  IF inserted_rows > 0 THEN
    UPDATE public.provider_statuses
    SET view_count = view_count + 1
    WHERE id = status_id
      AND expires_at > now();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_story_reply_to_messenger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  provider_user_id UUID;
  normalized_one UUID;
  normalized_two UUID;
  target_conversation_id UUID;
  story_message TEXT;
BEGIN
  SELECT user_id
  INTO provider_user_id
  FROM public.provider_statuses
  WHERE id = NEW.status_id;

  IF provider_user_id IS NULL OR provider_user_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id < provider_user_id THEN
    normalized_one := NEW.user_id;
    normalized_two := provider_user_id;
  ELSE
    normalized_one := provider_user_id;
    normalized_two := NEW.user_id;
  END IF;

  SELECT id
  INTO target_conversation_id
  FROM public.conversations
  WHERE participant_one = normalized_one
    AND participant_two = normalized_two
  ORDER BY created_at ASC
  LIMIT 1;

  IF target_conversation_id IS NULL THEN
    INSERT INTO public.conversations (participant_one, participant_two, last_message_at)
    VALUES (normalized_one, normalized_two, now())
    RETURNING id INTO target_conversation_id;
  END IF;

  story_message := format('📖 Story reply: "%s"', NEW.content);

  IF NOT EXISTS (
    SELECT 1
    FROM public.messages
    WHERE conversation_id = target_conversation_id
      AND sender_id = NEW.user_id
      AND content = story_message
      AND created_at >= now() - interval '10 seconds'
  ) THEN
    INSERT INTO public.messages (conversation_id, sender_id, content, read)
    VALUES (target_conversation_id, NEW.user_id, story_message, false);
  END IF;

  UPDATE public.conversations
  SET last_message_at = now()
  WHERE id = target_conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_story_reply_to_messenger ON public.status_replies;
CREATE TRIGGER sync_story_reply_to_messenger
AFTER INSERT ON public.status_replies
FOR EACH ROW
EXECUTE FUNCTION public.sync_story_reply_to_messenger();