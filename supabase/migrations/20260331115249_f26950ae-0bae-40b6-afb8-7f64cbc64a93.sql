-- Allow recipients (not senders) to mark messages as read, while preventing any other message edits.

DROP POLICY IF EXISTS "Sender can update own messages" ON public.messages;

CREATE POLICY "Recipients can mark messages as read"
ON public.messages
FOR UPDATE
USING (
  public.is_conversation_member(auth.uid(), conversation_id)
  AND auth.uid() <> sender_id
  AND read = false
)
WITH CHECK (
  public.is_conversation_member(auth.uid(), conversation_id)
  AND auth.uid() <> sender_id
  AND read = true
);

CREATE OR REPLACE FUNCTION public.validate_message_read_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF auth.uid() = OLD.sender_id THEN
    RAISE EXCEPTION 'Senders cannot update their own messages';
  END IF;

  IF NOT public.is_conversation_member(auth.uid(), OLD.conversation_id) THEN
    RAISE EXCEPTION 'Only conversation members can update messages';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only the read status can be updated';
  END IF;

  IF OLD.read = true THEN
    RETURN NEW;
  END IF;

  IF NEW.read IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Messages can only be marked as read';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_message_read_update ON public.messages;

CREATE TRIGGER validate_message_read_update
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.validate_message_read_update();