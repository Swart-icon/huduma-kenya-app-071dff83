-- Prevent users from self-activating premium. Only the service role
-- (used by the mpesa-callback edge function) may transition status to 'active'.
DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.premium_subscriptions;