
REVOKE EXECUTE ON FUNCTION public.send_broadcast_reminders() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.send_broadcast_reminders() TO service_role;
