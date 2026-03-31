
-- Job posts table
CREATE TABLE public.job_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  category_id uuid NOT NULL REFERENCES public.service_categories(id),
  title text NOT NULL,
  description text,
  budget numeric,
  budget_type text NOT NULL DEFAULT 'fixed',
  city text,
  county text,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.job_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Job posts are viewable by everyone" ON public.job_posts FOR SELECT TO public USING (status = 'open');
CREATE POLICY "Clients can view all own job posts" ON public.job_posts FOR SELECT TO public USING (auth.uid() = client_id);
CREATE POLICY "Clients can create job posts" ON public.job_posts FOR INSERT TO public WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can update own job posts" ON public.job_posts FOR UPDATE TO public USING (auth.uid() = client_id);
CREATE POLICY "Clients can delete own job posts" ON public.job_posts FOR DELETE TO public USING (auth.uid() = client_id);

CREATE TRIGGER update_job_posts_updated_at BEFORE UPDATE ON public.job_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Job responses table
CREATE TABLE public.job_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_post_id uuid NOT NULL REFERENCES public.job_posts(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL,
  message text,
  proposed_price numeric,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(job_post_id, provider_id)
);

ALTER TABLE public.job_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers can view own responses" ON public.job_responses FOR SELECT TO public USING (auth.uid() = provider_id);
CREATE POLICY "Clients can view responses to own jobs" ON public.job_responses FOR SELECT TO public USING (
  EXISTS (SELECT 1 FROM public.job_posts WHERE id = job_post_id AND client_id = auth.uid())
);
CREATE POLICY "Providers can create responses" ON public.job_responses FOR INSERT TO public WITH CHECK (auth.uid() = provider_id);
CREATE POLICY "Providers can update own responses" ON public.job_responses FOR UPDATE TO public USING (auth.uid() = provider_id);

CREATE TRIGGER update_job_responses_updated_at BEFORE UPDATE ON public.job_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bookings table
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  service_id uuid NOT NULL REFERENCES public.services(id),
  status text NOT NULL DEFAULT 'pending',
  notes text,
  booking_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view own bookings" ON public.bookings FOR SELECT TO public USING (auth.uid() = client_id);
CREATE POLICY "Providers can view bookings for them" ON public.bookings FOR SELECT TO public USING (auth.uid() = provider_id);
CREATE POLICY "Clients can create bookings" ON public.bookings FOR INSERT TO public WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Providers can update booking status" ON public.bookings FOR UPDATE TO public USING (auth.uid() = provider_id);
CREATE POLICY "Clients can update own bookings" ON public.bookings FOR UPDATE TO public USING (auth.uid() = client_id);

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
