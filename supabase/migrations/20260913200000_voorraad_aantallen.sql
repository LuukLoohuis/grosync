-- Voorraad in aantallen, met "bijna op" als losse vlag: een halfvolle pot is
-- bijna op terwijl er nog één staat, en daar is een niveau te grof voor.

ALTER TABLE public.pantry_items ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.pantry_items ADD COLUMN IF NOT EXISTS low BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'pantry_items' AND column_name = 'level') THEN
    -- Wat "op" was heeft er nul staan, wat "bijna" was krijgt de vlag.
    UPDATE public.pantry_items
       SET quantity = CASE WHEN level = 'op' THEN 0 ELSE 1 END,
           low = (level = 'bijna');
    -- De kolom blijft staan met een standaardwaarde, zodat een telefoon die de
    -- oude versie nog draait niets stukmaakt.
    ALTER TABLE public.pantry_items ALTER COLUMN level DROP NOT NULL;
    ALTER TABLE public.pantry_items ALTER COLUMN level SET DEFAULT 'ruim';
  END IF;
END $$;

ALTER TABLE public.pantry_items DROP CONSTRAINT IF EXISTS pantry_items_quantity_check;
ALTER TABLE public.pantry_items ADD CONSTRAINT pantry_items_quantity_check CHECK (quantity >= 0 AND quantity <= 99);
