DROP POLICY IF EXISTS "System can sync story replies into conversations" ON public.conversations;
CREATE POLICY "System can sync story replies into conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING ((auth.uid() = participant_one) OR (auth.uid() = participant_two));