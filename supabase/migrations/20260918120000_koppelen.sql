-- Koppelen: twee accounts in één omgeving. Wie de koppellink opent wordt lid
-- van het huishouden van de eigenaar en ziet vanaf dan alles: lijst, recepten,
-- kast, favorieten, weekplan. De policies "Shared list access" bestonden al;
-- dit maakt ontkoppelen mogelijk voor allebei en laat Plus voor het hele
-- huishouden gelden.

-- Een lid mag zichzelf ontkoppelen (de eigenaar mocht dat al).
DROP POLICY IF EXISTS "Lid ontkoppelt zichzelf" ON public.shared_list_members;
CREATE POLICY "Lid ontkoppelt zichzelf" ON public.shared_list_members
  FOR DELETE USING (member_id = auth.uid());

-- Plus geldt voor het huishouden: heeft je partner het, dan heb jij het ook.
CREATE OR REPLACE FUNCTION public.is_plus(_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plus_members
    WHERE (expires_at IS NULL OR expires_at > now())
      AND user_id IN (
        SELECT _user
        UNION SELECT owner_id FROM public.shared_list_members WHERE member_id = _user
        UNION SELECT member_id FROM public.shared_list_members WHERE owner_id = _user
      )
  );
$$;

-- De app vraagt het zo, zodat de client niet in andermans plus_members hoeft te kijken.
CREATE OR REPLACE FUNCTION public.my_plus()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_plus(auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.my_plus() TO authenticated;
