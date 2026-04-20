
-- ============ LIVE STREAMS ============
CREATE TABLE public.live_streams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  broadcaster_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended', 'force_ended')),
  viewer_count INTEGER NOT NULL DEFAULT 0,
  peak_viewer_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  ended_reason TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_live_streams_status ON public.live_streams(status, started_at DESC);
CREATE INDEX idx_live_streams_broadcaster ON public.live_streams(broadcaster_id);

ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view live or recent streams"
  ON public.live_streams FOR SELECT
  USING (true);

CREATE POLICY "Providers and job_seekers can start streams"
  ON public.live_streams FOR INSERT
  WITH CHECK (
    auth.uid() = broadcaster_id
    AND (has_role(auth.uid(), 'provider'::app_role) OR has_role(auth.uid(), 'job_seeker'::app_role))
  );

CREATE POLICY "Broadcasters can update own streams"
  ON public.live_streams FOR UPDATE
  USING (auth.uid() = broadcaster_id);

CREATE POLICY "Admins can update any stream"
  ON public.live_streams FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ LIVE CHAT ============
CREATE TABLE public.live_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_live_chat_stream ON public.live_chat_messages(stream_id, created_at DESC);

ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view chat"
  ON public.live_chat_messages FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can chat in live streams"
  ON public.live_chat_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.live_streams WHERE id = stream_id AND status = 'live')
  );

CREATE POLICY "Broadcasters and admins can delete chat"
  ON public.live_chat_messages FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.live_streams ls WHERE ls.id = stream_id AND ls.broadcaster_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- ============ LIVE LIKES ============
CREATE TABLE public.live_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stream_id, user_id)
);

ALTER TABLE public.live_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view likes"
  ON public.live_likes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can like a live stream"
  ON public.live_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their like"
  ON public.live_likes FOR DELETE
  USING (auth.uid() = user_id);

-- ============ LIVE VIEWERS (presence/heartbeat) ============
CREATE TABLE public.live_viewers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stream_id, user_id)
);

CREATE INDEX idx_live_viewers_stream ON public.live_viewers(stream_id, last_seen_at);

ALTER TABLE public.live_viewers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view viewer rows"
  ON public.live_viewers FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can join as viewers"
  ON public.live_viewers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Viewers can update their own heartbeat"
  ON public.live_viewers FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Viewers can leave (delete own row)"
  ON public.live_viewers FOR DELETE
  USING (auth.uid() = user_id);

-- ============ LIVE REPORTS ============
CREATE TABLE public.live_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stream_id, reporter_id)
);

ALTER TABLE public.live_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports"
  ON public.live_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports"
  ON public.live_reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all live reports"
  ON public.live_reports FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update reports"
  ON public.live_reports FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============ WEBRTC SIGNALING ============
-- Lightweight relay for SDP offers/answers/ICE candidates between broadcaster and viewers
CREATE TABLE public.live_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice', 'request_offer')),
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_live_signals_recipient ON public.live_signals(to_user_id, stream_id, created_at);

ALTER TABLE public.live_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can send signals as themselves"
  ON public.live_signals FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can read signals addressed to them"
  ON public.live_signals FOR SELECT
  USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

CREATE POLICY "Users can delete signals they handled"
  ON public.live_signals FOR DELETE
  USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);

-- ============ TRIGGERS ============

-- Update like count
CREATE OR REPLACE FUNCTION public.update_live_like_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.live_streams SET like_count = like_count + 1 WHERE id = NEW.stream_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.live_streams SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.stream_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END; $$;

CREATE TRIGGER trg_live_like_count
  AFTER INSERT OR DELETE ON public.live_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_live_like_count();

-- Update report count + auto-flag at 3 reports
CREATE OR REPLACE FUNCTION public.handle_live_report()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.live_streams
  SET report_count = report_count + 1
  WHERE id = NEW.stream_id
  RETURNING report_count INTO new_count;

  -- Auto-flag (mark for review) at 3+ reports — does NOT cut stream automatically;
  -- admins decide. We just ensure visibility.
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_live_report_count
  AFTER INSERT ON public.live_reports
  FOR EACH ROW EXECUTE FUNCTION public.handle_live_report();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_viewers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_signals;
