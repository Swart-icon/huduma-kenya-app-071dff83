-- Add documents column for optional certificate/ID uploads
ALTER TABLE public.job_seeker_profiles
  ADD COLUMN IF NOT EXISTS documents jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Create a public storage bucket for job seeker documents (certificates, IDs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-seeker-docs', 'job-seeker-docs', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage bucket
DO $$ BEGIN
  CREATE POLICY "Job seeker docs are publicly viewable"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'job-seeker-docs');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can upload own job seeker docs"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'job-seeker-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own job seeker docs"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'job-seeker-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own job seeker docs"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'job-seeker-docs' AND auth.uid()::text = (storage.foldername(name))[1]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;