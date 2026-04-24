DROP POLICY IF EXISTS "Applicants can create applications" ON public.job_applications;

CREATE POLICY "Premium job seekers can create applications"
ON public.job_applications
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = applicant_id
  AND EXISTS (
    SELECT 1
    FROM public.premium_subscriptions ps
    WHERE ps.user_id = auth.uid()
      AND ps.role_type = 'job_seeker'
      AND ps.status = 'active'
      AND ps.expires_at IS NOT NULL
      AND ps.expires_at > now()
  )
);