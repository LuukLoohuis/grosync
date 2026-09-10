-- Gekozen AH-product per boodschap. `price` blijft het regelbedrag
-- (stuksprijs maal aantal), zodat bestaande totalen blijven kloppen.
ALTER TABLE public.grocery_items
  ADD COLUMN IF NOT EXISTS ah_product_id INTEGER,
  ADD COLUMN IF NOT EXISTS ah_product_title TEXT,
  ADD COLUMN IF NOT EXISTS ah_unit_size TEXT,
  ADD COLUMN IF NOT EXISTS ah_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS ah_image_url TEXT,
  ADD COLUMN IF NOT EXISTS ah_is_bonus BOOLEAN,
  ADD COLUMN IF NOT EXISTS price_checked_at TIMESTAMPTZ;
