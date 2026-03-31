
-- Job Applications table (job seekers apply to job posts)
CREATE TABLE public.job_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_post_id UUID NOT NULL REFERENCES public.job_posts(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL,
  cover_message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (job_post_id, applicant_id)
);

-- Saved Jobs table (bookmarked jobs)
CREATE TABLE public.saved_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  job_post_id UUID NOT NULL REFERENCES public.job_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_post_id)
);

-- Job Seeker Profiles table (structured profile data)
CREATE TABLE public.job_seeker_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  skills TEXT[] DEFAULT '{}',
  experience_years INTEGER DEFAULT 0,
  experience_description TEXT,
  education TEXT,
  certifications TEXT,
  cv_url TEXT,
  bio TEXT,
  preferred_categories UUID[] DEFAULT '{}',
  preferred_county TEXT,
  preferred_city TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_seeker_profiles ENABLE ROW LEVEL SECURITY;

-- RLS for job_applications
CREATE POLICY "Applicants can create applications" ON public.job_applications
  FOR INSERT WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY "Applicants can view own applications" ON public.job_applications
  FOR SELECT USING (auth.uid() = applicant_id);

CREATE POLICY "Applicants can update own applications" ON public.job_applications
  FOR UPDATE USING (auth.uid() = applicant_id);

CREATE POLICY "Job owners can view applications" ON public.job_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.job_posts
      WHERE job_posts.id = job_applications.job_post_id
        AND job_posts.client_id = auth.uid()
    )
  );

CREATE POLICY "Job owners can update application status" ON public.job_applications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.job_posts
      WHERE job_posts.id = job_applications.job_post_id
        AND job_posts.client_id = auth.uid()
    )
  );

-- RLS for saved_jobs
CREATE POLICY "Users can manage own saved jobs" ON public.saved_jobs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RLS for job_seeker_profiles
CREATE POLICY "Users can view own profile" ON public.job_seeker_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own profile" ON public.job_seeker_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.job_seeker_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Everyone can view job seeker profiles" ON public.job_seeker_profiles
  FOR SELECT USING (true);

-- Updated_at triggers
CREATE TRIGGER update_job_applications_updated_at
  BEFORE UPDATE ON public.job_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_seeker_profiles_updated_at
  BEFORE UPDATE ON public.job_seeker_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for applications
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_applications;
