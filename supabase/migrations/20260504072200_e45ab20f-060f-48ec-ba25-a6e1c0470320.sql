-- Add purpose tracking and external_reference to mpesa_transactions for robust matching
ALTER TABLE public.mpesa_transactions
  ADD COLUMN IF NOT EXISTS external_reference TEXT,
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS boost_id UUID;

CREATE INDEX IF NOT EXISTS idx_mpesa_tx_external_ref ON public.mpesa_transactions(external_reference);
CREATE INDEX IF NOT EXISTS idx_mpesa_tx_user_created ON public.mpesa_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mpesa_tx_status ON public.mpesa_transactions(status);
CREATE INDEX IF NOT EXISTS idx_mpesa_tx_receipt ON public.mpesa_transactions(mpesa_receipt);

-- Auto-fail stale pending transactions (older than 10 minutes, never got callback)
CREATE OR REPLACE FUNCTION public.expire_stale_mpesa_transactions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count INTEGER := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, subscription_id, boost_id, external_reference
    FROM public.mpesa_transactions
    WHERE status = 'pending'
      AND created_at < now() - interval '10 minutes'
    LIMIT 200
  LOOP
    UPDATE public.mpesa_transactions
       SET status = 'failed',
           result_desc = COALESCE(result_desc, 'No callback received within 10 minutes'),
           updated_at = now()
     WHERE id = rec.id;

    IF rec.subscription_id IS NOT NULL THEN
      UPDATE public.premium_subscriptions
         SET status = 'failed', updated_at = now()
       WHERE id = rec.subscription_id AND status = 'pending';
    END IF;

    IF rec.boost_id IS NOT NULL THEN
      UPDATE public.status_boosts
         SET payment_status = 'failed', is_active = false
       WHERE id = rec.boost_id AND payment_status = 'pending';
    ELSIF rec.external_reference LIKE 'boost_%' THEN
      UPDATE public.status_boosts
         SET payment_status = 'failed', is_active = false
       WHERE id::text = substring(rec.external_reference from 7) AND payment_status = 'pending';
    END IF;

    expired_count := expired_count + 1;
  END LOOP;
  RETURN expired_count;
END;
$$;

-- Schedule cleanup every 5 minutes (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('expire-stale-mpesa-tx');
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'expire-stale-mpesa-tx',
      '*/5 * * * *',
      $cron$ SELECT public.expire_stale_mpesa_transactions(); $cron$
    );
  END IF;
END $$;