
CREATE OR REPLACE FUNCTION public.sync_story_reply_to_messenger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  provider_user_id UUID;
  story_image_url TEXT;
  story_text TEXT;
  normalized_one UUID;
  normalized_two UUID;
  target_conversation_id UUID;
  story_message TEXT;
BEGIN
  SELECT user_id, image_url, text_content
  INTO provider_user_id, story_image_url, story_text
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

  -- Build JSON message with story context
  story_message := json_build_object(
    '__type', true,
    'type', 'story_reply',
    'text', NEW.content,
    'storyImageUrl', COALESCE(story_image_url, ''),
    'storyText', COALESCE(story_text, '')
  )::text;

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
