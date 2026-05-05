
-- 1. video_boosts table
CREATE TABLE public.video_boosts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_id UUID NOT NULL,
  package_type TEXT NOT NULL,
  amount_kes NUMERIC NOT NULL,
  target_impressions INTEGER NOT NULL,
  delivered_impressions INTEGER NOT NULL DEFAULT 0,
  remaining_impressions INTEGER NOT NULL,
  payment_provider TEXT NOT NULL,
  payment_reference TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  campaign_status TEXT NOT NULL DEFAULT 'inactive',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_video_boosts_video ON public.video_boosts(video_id);
CREATE INDEX idx_video_boosts_user ON public.video_boosts(user_id);
CREATE INDEX idx_video_boosts_status ON public.video_boosts(campaign_status);
CREATE INDEX idx_video_boosts_active ON public.video_boosts(campaign_status, remaining_impressions)
  WHERE campaign_status = 'active';

ALTER TABLE public.video_boosts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own boosts"
  ON public.video_boosts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated view active boosts"
  ON public.video_boosts FOR SELECT
  USING (auth.uid() IS NOT NULL AND campaign_status = 'active');

CREATE POLICY "Admins view all boosts"
  ON public.video_boosts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update boosts"
  ON public.video_boosts FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- INSERT/UPDATE by users is intentionally NOT permitted; only edge functions
-- using the service role can create/activate boosts.

-- 2. impressions dedup table
CREATE TABLE public.video_boost_impressions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  boost_id UUID NOT NULL REFERENCES public.video_boosts(id) ON DELETE CASCADE,
  viewer_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (boost_id, viewer_id)
);

CREATE INDEX idx_vbi_boost ON public.video_boost_impressions(boost_id);

ALTER TABLE public.video_boost_impressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own boost impressions"
  ON public.video_boost_impressions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.video_boosts vb
    WHERE vb.id = video_boost_impressions.boost_id
      AND vb.user_id = auth.uid()
  ));

CREATE POLICY "Admins view all boost impressions"
  ON public.video_boost_impressions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. link mpesa_transactions to video boost
ALTER TABLE public.mpesa_transactions
  ADD COLUMN video_boost_id UUID;

CREATE INDEX idx_mpesa_tx_video_boost ON public.mpesa_transactions(video_boost_id);

-- 4. RPC: record one valid impression
CREATE OR REPLACE FUNCTION public.record_boost_impression(_boost_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted INTEGER := 0;
  _remaining INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Only count for active campaigns
  IF NOT EXISTS (
    SELECT 1 FROM public.video_boosts
    WHERE id = _boost_id
      AND campaign_status = 'active'
      AND remaining_impressions > 0
  ) THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.video_boost_impressions (boost_id, viewer_id)
  VALUES (_boost_id, auth.uid())
  ON CONFLICT (boost_id, viewer_id) DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted = 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE public.video_boosts
  SET delivered_impressions = delivered_impressions + 1,
      remaining_impressions = GREATEST(remaining_impressions - 1, 0)
  WHERE id = _boost_id
  RETURNING remaining_impressions INTO _remaining;

  IF _remaining = 0 THEN
    UPDATE public.video_boosts
    SET campaign_status = 'completed',
        completed_at = now()
    WHERE id = _boost_id;
  END IF;

  RETURN TRUE;
END;
$$;

-- 5. RPC: fetch active boosted videos for the feed (region-ranked)
CREATE OR REPLACE FUNCTION public.boosted_videos_for_feed(
  _user_city TEXT DEFAULT NULL,
  _user_county TEXT DEFAULT NULL,
  _limit_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  boost_id UUID,
  video_id UUID,
  user_id UUID,
  remaining_impressions INTEGER,
  location_rank INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    vb.id AS boost_id,
    vb.video_id,
    vb.user_id,
    vb.remaining_impressions,
    CASE
      WHEN _user_city IS NOT NULL AND lower(v.city) = lower(_user_city) THEN 0
      WHEN _user_county IS NOT NULL AND lower(v.county) = lower(_user_county) THEN 1
      ELSE 2
    END AS location_rank
  FROM public.video_boosts vb
  JOIN public.videos v ON v.id = vb.video_id
  WHERE vb.campaign_status = 'active'
    AND vb.remaining_impressions > 0
    AND v.status = 'active'
  ORDER BY location_rank ASC, vb.created_at DESC
  LIMIT _limit_count;
$$;
