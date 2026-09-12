-- De bonus van Albert Heijn, één keer opgehaald voor iedereen samen.
-- Alleen de edge function schrijft (die draait met de service role en gaat langs RLS);
-- iedereen die ingelogd is, mag lezen.
CREATE TABLE IF NOT EXISTS public.bonus_products (
  product_id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  unit_size TEXT,
  category TEXT,
  mechanism TEXT,
  price NUMERIC,
  price_before NUMERIC,
  start_date DATE,
  end_date DATE,
  image_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bonus_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ingelogd leest de bonus" ON public.bonus_products;
CREATE POLICY "Ingelogd leest de bonus" ON public.bonus_products
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS bonus_products_fetched_at_idx ON public.bonus_products (fetched_at DESC);
