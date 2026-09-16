-- Wat een boodschap zonder bonus zou kosten, zodat de app kan laten zien wat
-- de bonus scheelt. Leeg als er geen bonus op zit.
ALTER TABLE public.grocery_items ADD COLUMN IF NOT EXISTS price_before NUMERIC;
