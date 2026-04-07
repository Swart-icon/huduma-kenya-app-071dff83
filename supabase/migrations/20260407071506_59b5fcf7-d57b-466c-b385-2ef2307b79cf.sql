-- Status boosts table
CREATE TABLE public.status_boosts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  status_id UUID NOT NULL REFERENCES public.provider_statuses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  boost_tier TEXT NOT NULL DEFAULT 'moderate',
  amount_kes NUMERIC NOT NULL DEFAULT 50,
  payment_method TEXT NOT NULL DEFAULT 'mpesa',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_reference TEXT,
  boost_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  boost_end TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.status_boosts ENABLE ROW LEVEL SECURITY;

-- Providers can create boosts for their own statuses
CREATE POLICY "Providers can create boosts"
  ON public.status_boosts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Providers can view their own boosts
CREATE POLICY "Providers can view own boosts"
  ON public.status_boosts FOR SELECT
  USING (auth.uid() = user_id);

-- Everyone can see active boosts for ranking
CREATE POLICY "Active boosts are publicly visible"
  ON public.status_boosts FOR SELECT
  USING (is_active = true AND payment_status = 'completed' AND boost_end > now());

-- Providers can update own boosts (for payment confirmation)
CREATE POLICY "Providers can update own boosts"
  ON public.status_boosts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_status_boosts_status ON public.status_boosts (status_id);
CREATE INDEX idx_status_boosts_active ON public.status_boosts (is_active, boost_end) WHERE is_active = true;

-- Prevent multiple active boosts on same status
CREATE UNIQUE INDEX idx_one_active_boost_per_status 
  ON public.status_boosts (status_id) 
  WHERE is_active = true AND payment_status = 'completed';