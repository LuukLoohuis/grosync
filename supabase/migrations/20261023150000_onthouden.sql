-- Wat jullie bij een product kozen, voor de volgende keer: shampoo komt van
-- de Kruidvat, yoghurtdrank is "Optimel, de blauwe" (met foto). Eén rij per
-- product per huishouden; de sleutel is de naam zonder aantal, in kleine letters.
CREATE TABLE IF NOT EXISTS public.item_memory (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sleutel TEXT NOT NULL CHECK (char_length(sleutel) BETWEEN 1 AND 80),
  store TEXT CHECK (store IS NULL OR char_length(store) BETWEEN 1 AND 30),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 120),
  photo TEXT CHECK (photo IS NULL OR (photo LIKE 'data:image/jpeg;base64,%' AND char_length(photo) <= 80000)),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sleutel)
);

ALTER TABLE public.item_memory ENABLE ROW LEVEL SECURITY;

-- Zelfde toegang als de lijst: de eigenaar en wie in de Cart Club zit.
DROP POLICY IF EXISTS "Huishouden" ON public.item_memory;
CREATE POLICY "Huishouden" ON public.item_memory
  FOR ALL TO authenticated
  USING (public.has_shared_access(user_id))
  WITH CHECK (public.has_shared_access(user_id));

REVOKE ALL ON public.item_memory FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_memory TO authenticated;
