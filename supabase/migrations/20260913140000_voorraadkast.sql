-- De voorraadkast: wat er in huis is, in drie standen in plaats van aantallen.
-- Een foto kan geen "3 stuks" zien en niemand telt potjes, dus ruim / bijna / op.

CREATE TABLE IF NOT EXISTS public.pantry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'ruim' CHECK (level IN ('ruim', 'bijna', 'op')),
  -- Waar het vandaan kwam: foto, afgevinkte boodschap of met de hand.
  source TEXT NOT NULL DEFAULT 'handmatig',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Eén regel per product per huishouden, ongeacht hoofdletters.
CREATE UNIQUE INDEX IF NOT EXISTS pantry_items_user_name_idx ON public.pantry_items (user_id, lower(name));

ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner full access" ON public.pantry_items;
CREATE POLICY "Owner full access" ON public.pantry_items FOR ALL TO public
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Shared list access" ON public.pantry_items;
CREATE POLICY "Shared list access" ON public.pantry_items FOR ALL TO public
  USING (public.has_shared_access(user_id)) WITH CHECK (public.has_shared_access(user_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pantry_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pantry_items;
  END IF;
END $$;
