-- Recepten indelen: "Vega", "Snel", of wat je zelf verzint.
--
-- De labels staan als tekst op het recept, zodat filteren één query blijft.
-- De tabel eronder bewaart welke categorieën iemand heeft aangemaakt, met een
-- kleur erbij, zodat een categorie ook bestaat voordat er een recept in zit.

ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.recipe_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'groen',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS recipe_categories_user_idx ON public.recipe_categories (user_id);

ALTER TABLE public.recipe_categories ENABLE ROW LEVEL SECURITY;

-- Zelfde toegang als de recepten zelf: eigenaar, plus wie de lijst deelt.
DROP POLICY IF EXISTS "Owner full access" ON public.recipe_categories;
CREATE POLICY "Owner full access" ON public.recipe_categories FOR ALL TO public
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Shared list access" ON public.recipe_categories;
CREATE POLICY "Shared list access" ON public.recipe_categories FOR ALL TO public
  USING (public.has_shared_access(user_id)) WITH CHECK (public.has_shared_access(user_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'recipe_categories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_categories;
  END IF;
END $$;
