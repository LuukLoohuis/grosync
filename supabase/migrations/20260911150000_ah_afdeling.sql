-- Afdeling die AH zelf opgeeft voor het gekozen product, zodat de lijst per
-- afdeling kan sorteren zoals in de winkel.
ALTER TABLE public.grocery_items ADD COLUMN IF NOT EXISTS ah_category TEXT;
