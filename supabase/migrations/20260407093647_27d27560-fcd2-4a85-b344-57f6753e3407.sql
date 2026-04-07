CREATE POLICY "Participants can update own conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING ((auth.uid() = participant_one) OR (auth.uid() = participant_two))
WITH CHECK ((auth.uid() = participant_one) OR (auth.uid() = participant_two));
