-- Goods table for products sold by providers
CREATE TABLE public.goods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  price_type TEXT NOT NULL DEFAULT 'fixed',
  condition TEXT NOT NULL DEFAULT 'new',
  stock_quantity INTEGER,
  images TEXT[] NOT NULL DEFAULT '{}',
  city TEXT,
  county TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_active BOOLEAN NOT NULL DEFAULT true,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_goods_category ON public.goods(category_id);
CREATE INDEX idx_goods_seller ON public.goods(seller_id);
CREATE INDEX idx_goods_active ON public.goods(is_active) WHERE is_active = true;

ALTER TABLE public.goods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active goods"
  ON public.goods FOR SELECT
  USING (is_active = true OR auth.uid() = seller_id);

CREATE POLICY "Sellers can insert their own goods"
  ON public.goods FOR INSERT
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own goods"
  ON public.goods FOR UPDATE
  USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own goods"
  ON public.goods FOR DELETE
  USING (auth.uid() = seller_id);

CREATE TRIGGER update_goods_updated_at
  BEFORE UPDATE ON public.goods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Public bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Product images are publicly viewable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "Sellers can upload their own product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Sellers can update their own product images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Sellers can delete their own product images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);