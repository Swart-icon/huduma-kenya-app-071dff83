
-- Payments table
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_method text NOT NULL DEFAULT 'mpesa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can create payments" ON public.payments FOR INSERT TO public WITH CHECK (auth.uid() = client_id);
CREATE POLICY "Clients can view own payments" ON public.payments FOR SELECT TO public USING (auth.uid() = client_id);
CREATE POLICY "Providers can view own payments" ON public.payments FOR SELECT TO public USING (auth.uid() = provider_id);

-- Reviews table
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view reviews" ON public.reviews FOR SELECT TO public USING (true);
CREATE POLICY "Clients can create reviews" ON public.reviews FOR INSERT TO public WITH CHECK (auth.uid() = client_id);

-- Validation trigger: only allow reviews for completed bookings where client matches
CREATE OR REPLACE FUNCTION public.validate_review_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE id = NEW.booking_id
      AND client_id = NEW.client_id
      AND status = 'completed'
  ) THEN
    RAISE EXCEPTION 'Review can only be created for your own completed bookings';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_review
  BEFORE INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_review_insert();

-- Indexes
CREATE INDEX idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX idx_payments_client_id ON public.payments(client_id);
CREATE INDEX idx_payments_provider_id ON public.payments(provider_id);
CREATE INDEX idx_reviews_provider_id ON public.reviews(provider_id);
CREATE INDEX idx_reviews_booking_id ON public.reviews(booking_id);

-- Enable realtime for payments
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
