-- Make bucket private so storage RLS is enforced
UPDATE storage.buckets SET public = false WHERE id = 'chat-attachments';

-- Drop existing permissive policies on chat-attachments objects
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual LIKE '%chat-attachments%' OR with_check LIKE '%chat-attachments%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- SELECT: only conversation participants (path = {userId}/{conversationId}/filename)
CREATE POLICY "Chat attachments viewable by conversation participants"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND public.is_conversation_member(
    auth.uid(),
    NULLIF((storage.foldername(name))[2], '')::uuid
  )
);

-- INSERT: must upload into own user folder, into a conversation they participate in
CREATE POLICY "Users can upload chat attachments to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
  AND public.is_conversation_member(
    auth.uid(),
    NULLIF((storage.foldername(name))[2], '')::uuid
  )
);

-- UPDATE: uploader only
CREATE POLICY "Users can update own chat attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- DELETE: uploader only
CREATE POLICY "Users can delete own chat attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);