
-- Premium subscriptions table
CREATE TABLE public.premium_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role_type TEXT NOT NULL CHECK (role_type IN ('provider', 'job_seeker')),
  amount_kes NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'expired', 'cancelled', 'failed')),
  payment_method TEXT NOT NULL DEFAULT 'mpesa',
  payment_reference TEXT,
  mpesa_receipt TEXT,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_premium_subs_user ON public.premium_subscriptions(user_id, role_type, status);
CREATE INDEX idx_premium_subs_expires ON public.premium_subscriptions(expires_at) WHERE status = 'active';

ALTER TABLE public.premium_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscriptions"
  ON public.premium_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own subscriptions"
  ON public.premium_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON public.premium_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions"
  ON public.premium_subscriptions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update all subscriptions"
  ON public.premium_subscriptions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- M-Pesa transactions log
CREATE TABLE public.mpesa_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  subscription_id UUID REFERENCES public.premium_subscriptions(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  amount_kes NUMERIC NOT NULL,
  checkout_request_id TEXT,
  merchant_request_id TEXT,
  mpesa_receipt TEXT,
  result_code INTEGER,
  result_desc TEXT,
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'success', 'failed', 'cancelled')),
  raw_callback JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mpesa_tx_user ON public.mpesa_transactions(user_id);
CREATE INDEX idx_mpesa_tx_checkout ON public.mpesa_transactions(checkout_request_id);

ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.mpesa_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions"
  ON public.mpesa_transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated-at trigger
CREATE TRIGGER update_premium_subs_updated_at
  BEFORE UPDATE ON public.premium_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mpesa_tx_updated_at
  BEFORE UPDATE ON public.mpesa_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper: check if user has active subscription for a role
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id UUID, _role_type TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.premium_subscriptions
    WHERE user_id = _user_id
      AND role_type = _role_type
      AND status = 'active'
      AND expires_at > now()
  );
$$;
