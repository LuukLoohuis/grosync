-- Instellingen per account. Eerst: wat je altijd in huis hebt. Die ingrediënten
-- staan uitgevinkt als je een recept op je lijst zet.
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pantry_staples TEXT[] NOT NULL DEFAULT ARRAY['zout', 'peper', 'olijfolie', 'zonnebloemolie', 'suiker', 'bloem', 'water'],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Zelfde regel als de andere tabellen: eigenaar of vastgelegd lid.
DROP POLICY IF EXISTS "Shared list access" ON public.user_settings;
CREATE POLICY "Shared list access" ON public.user_settings FOR ALL TO public
  USING (public.has_shared_access(user_id))
  WITH CHECK (public.has_shared_access(user_id));
