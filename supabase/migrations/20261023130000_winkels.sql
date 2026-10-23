-- Eén lijst, meerdere winkels: elk item kan een winkellabel krijgen (AH,
-- Kruidvat, Action, markt, of zelf getypt). Leeg = maakt niet uit waar; dat
-- item staat in elke winkel op je lijst.
ALTER TABLE public.grocery_items
  ADD COLUMN IF NOT EXISTS store TEXT;

ALTER TABLE public.grocery_items
  DROP CONSTRAINT IF EXISTS grocery_items_store_length,
  ADD CONSTRAINT grocery_items_store_length CHECK (store IS NULL OR char_length(store) BETWEEN 1 AND 30);
