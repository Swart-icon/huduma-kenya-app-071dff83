
-- 1. notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  broadcasts_enabled BOOLEAN NOT NULL DEFAULT true,
  reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own prefs" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own prefs" ON public.notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own prefs" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins view all prefs" ON public.notification_preferences
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. tracking columns on broadcast_recipients
ALTER TABLE public.broadcast_recipients
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- 3. trigger: when recipient is created, insert a notifications row (respecting prefs)
CREATE OR REPLACE FUNCTION public.create_notification_for_broadcast_recipient()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b_title TEXT;
  b_body TEXT;
  enabled BOOLEAN;
BEGIN
  SELECT broadcasts_enabled INTO enabled
  FROM public.notification_preferences
  WHERE user_id = NEW.user_id;

  IF enabled IS NOT NULL AND enabled = false THEN
    RETURN NEW;
  END IF;

  SELECT title, body INTO b_title, b_body
  FROM public.broadcast_messages
  WHERE id = NEW.broadcast_id;

  INSERT INTO public.notifications (user_id, type, title, body, reference_id)
  VALUES (
    NEW.user_id,
    'broadcast',
    COALESCE(b_title, 'New announcement'),
    COALESCE(LEFT(b_body, 140), ''),
    NEW.broadcast_id
  );

  UPDATE public.broadcast_recipients
  SET delivered_at = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_recipient_notify ON public.broadcast_recipients;
CREATE TRIGGER trg_broadcast_recipient_notify
  AFTER INSERT ON public.broadcast_recipients
  FOR EACH ROW EXECUTE FUNCTION public.create_notification_for_broadcast_recipient();

-- 4. allow trigger-driven inserts into notifications (system-level)
DROP POLICY IF EXISTS "System can create broadcast notifications" ON public.notifications;
CREATE POLICY "System can create broadcast notifications" ON public.notifications
  FOR INSERT WITH CHECK (type = 'broadcast' OR has_role(auth.uid(), 'admin'::app_role));

-- 5. function for reminder cron
CREATE OR REPLACE FUNCTION public.send_broadcast_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  count_sent INTEGER := 0;
BEGIN
  FOR rec IN
    SELECT br.id, br.user_id, br.broadcast_id, bm.title, bm.body
    FROM public.broadcast_recipients br
    JOIN public.broadcast_messages bm ON bm.id = br.broadcast_id
    LEFT JOIN public.notification_preferences np ON np.user_id = br.user_id
    WHERE br.read = false
      AND br.reminder_sent_at IS NULL
      AND br.created_at < now() - interval '12 hours'
      AND br.created_at > now() - interval '7 days'
      AND COALESCE(np.reminders_enabled, true) = true
      AND COALESCE(np.broadcasts_enabled, true) = true
    LIMIT 500
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, reference_id)
    VALUES (
      rec.user_id,
      'broadcast_reminder',
      'Reminder: ' || rec.title,
      LEFT(COALESCE(rec.body, ''), 140),
      rec.broadcast_id
    );

    UPDATE public.broadcast_recipients
    SET reminder_sent_at = now()
    WHERE id = rec.id;

    count_sent := count_sent + 1;
  END LOOP;

  RETURN count_sent;
END;
$$;
