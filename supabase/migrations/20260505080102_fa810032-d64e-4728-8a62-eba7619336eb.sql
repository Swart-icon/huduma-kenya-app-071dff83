
ALTER TABLE public.mpesa_transactions
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'mpesa',
  ADD COLUMN IF NOT EXISTS paystack_reference TEXT,
  ADD COLUMN IF NOT EXISTS payment_channel TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'KES',
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.mpesa_transactions
  ALTER COLUMN phone_number DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mpesa_transactions_paystack_ref_idx
  ON public.mpesa_transactions(paystack_reference)
  WHERE paystack_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS mpesa_transactions_provider_idx
  ON public.mpesa_transactions(provider);
