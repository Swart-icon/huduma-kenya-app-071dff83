-- Broadcast messages authored by admins
CREATE TABLE public.broadcast_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience_type TEXT NOT NULL DEFAULT 'all', -- 'all' | 'role' | 'location'
  target_role TEXT, -- 'client' | 'provider' | 'job_seeker'
  target_city TEXT,
  target_county TEXT,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-user recipient row (the inbox entries)
CREATE TABLE public.broadcast_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  broadcast_id UUID NOT NULL REFERENCES public.broadcast_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (broadcast_id, user_id)
);

CREATE INDEX idx_broadcast_recipients_user ON public.broadcast_recipients(user_id, read);
CREATE INDEX idx_broadcast_messages_created ON public.broadcast_messages(created_at DESC);

ALTER TABLE public.broadcast_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_recipients ENABLE ROW LEVEL SECURITY;

-- broadcast_messages policies
CREATE POLICY "Admins can create broadcasts"
ON public.broadcast_messages FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = sender_id);

CREATE POLICY "Admins can view all broadcasts"
ON public.broadcast_messages FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Recipients can view broadcasts addressed to them"
ON public.broadcast_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.broadcast_recipients br
  WHERE br.broadcast_id = broadcast_messages.id AND br.user_id = auth.uid()
));

-- broadcast_recipients policies
CREATE POLICY "Admins can view all recipients"
ON public.broadcast_recipients FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own inbox"
ON public.broadcast_recipients FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can mark own messages read"
ON public.broadcast_recipients FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- System inserts recipients via trigger (security definer); allow admin manual insert too
CREATE POLICY "Admins can insert recipients"
ON public.broadcast_recipients FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Anti-spam: rate-limit admin to 5 broadcasts / hour
CREATE OR REPLACE FUNCTION public.enforce_broadcast_rate_limit()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO recent_count
  FROM public.broadcast_messages
  WHERE sender_id = NEW.sender_id
    AND created_at > now() - interval '1 hour';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit: max 5 broadcasts per hour. Please wait before sending another.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_broadcast_rate_limit
BEFORE INSERT ON public.broadcast_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_broadcast_rate_limit();

-- Fan-out trigger: after a broadcast is created, insert recipient rows for matching users
CREATE OR REPLACE FUNCTION public.fanout_broadcast_recipients()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inserted_count INTEGER := 0;
BEGIN
  IF NEW.audience_type = 'all' THEN
    INSERT INTO public.broadcast_recipients (broadcast_id, user_id)
    SELECT NEW.id, p.user_id FROM public.profiles p
    ON CONFLICT (broadcast_id, user_id) DO NOTHING;

  ELSIF NEW.audience_type = 'role' AND NEW.target_role IS NOT NULL THEN
    INSERT INTO public.broadcast_recipients (broadcast_id, user_id)
    SELECT NEW.id, ur.user_id FROM public.user_roles ur
    WHERE ur.role::text = NEW.target_role
    ON CONFLICT (broadcast_id, user_id) DO NOTHING;

  ELSIF NEW.audience_type = 'location' THEN
    INSERT INTO public.broadcast_recipients (broadcast_id, user_id)
    SELECT NEW.id, p.user_id FROM public.profiles p
    WHERE (NEW.target_city IS NULL OR lower(p.location) LIKE '%' || lower(NEW.target_city) || '%')
       OR (NEW.target_county IS NULL OR lower(p.location) LIKE '%' || lower(NEW.target_county) || '%')
    ON CONFLICT (broadcast_id, user_id) DO NOTHING;
  END IF;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  UPDATE public.broadcast_messages SET recipient_count = inserted_count WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fanout_broadcast
AFTER INSERT ON public.broadcast_messages
FOR EACH ROW EXECUTE FUNCTION public.fanout_broadcast_recipients();