-- Deeltoegang op basis van lidmaatschap in plaats van "iedereen mag alles
-- van iemand die ooit gedeeld heeft".
--
-- Oude situatie: de policy "Shared list access" gebruikte
-- user_has_shared_list(user_id), die alleen controleert of de eigenaar
-- een deellijst heeft. Wie de publieke key uit de bundel haalde kon
-- daarmee alle rijen van al die gebruikers lezen en wijzigen.
--
-- Nieuwe situatie: het openen van een deellink legt een lidmaatschap vast
-- op de ingelogde (eventueel anonieme) gebruiker. De policies kijken naar
-- auth.uid(), zodat ze ook gelden voor realtime-meldingen.

CREATE TABLE IF NOT EXISTS public.shared_list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.shared_lists(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  member_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (list_id, member_id)
);

ALTER TABLE public.shared_list_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lid ziet eigen lidmaatschap" ON public.shared_list_members;
CREATE POLICY "Lid ziet eigen lidmaatschap" ON public.shared_list_members
  FOR SELECT USING (member_id = auth.uid() OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Eigenaar verwijdert lidmaatschap" ON public.shared_list_members;
CREATE POLICY "Eigenaar verwijdert lidmaatschap" ON public.shared_list_members
  FOR DELETE USING (owner_id = auth.uid());

-- Toevoegen gebeurt uitsluitend via join_shared_list hieronder; die draait
-- als SECURITY DEFINER en heeft dus geen INSERT-policy nodig.

-- Wisselt een deelcode in voor lidmaatschap en geeft de eigenaar terug.
CREATE OR REPLACE FUNCTION public.join_shared_list(_share_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _list public.shared_lists%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Inloggen is vereist om een gedeelde lijst te openen';
  END IF;

  SELECT * INTO _list FROM public.shared_lists WHERE share_code = _share_code;
  IF NOT FOUND OR _list.user_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.shared_list_members (list_id, owner_id, member_id)
  VALUES (_list.id, _list.user_id, auth.uid())
  ON CONFLICT (list_id, member_id) DO NOTHING;

  RETURN _list.user_id;
END;
$$;

-- Eigenaar of vastgelegd lid.
CREATE OR REPLACE FUNCTION public.has_shared_access(_owner UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.shared_list_members
        WHERE owner_id = _owner AND member_id = auth.uid()
      );
$$;

-- Policies omzetten op alle tabellen die per gebruiker gedeeld worden.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['grocery_items', 'recipes', 'usuals', 'purchase_history', 'meal_plans'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Shared list access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Shared list access" ON public.%I FOR ALL TO public
         USING (public.has_shared_access(user_id))
         WITH CHECK (public.has_shared_access(user_id))', t);
  END LOOP;
END $$;
