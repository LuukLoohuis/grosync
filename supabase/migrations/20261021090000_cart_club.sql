-- Cart Club: koppelen met meer dan één persoon. Het lidmaatschap kon al
-- meerdere leden per eigenaar aan; wat ontbrak was zien wie er in de club zit
-- (de policy op shared_list_members laat een lid alleen zijn eigen rij zien)
-- en een uitnodiging bekijken zonder meteen lid te worden.

-- Naam zoals de club hem toont: Google-naam, anders het deel van het
-- e-mailadres voor de @. Een gast heeft geen van beide en krijgt NULL.
CREATE OR REPLACE FUNCTION public.cart_club_naam(_user UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT COALESCE(
    NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
    NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
    NULLIF(split_part(u.email, '@', 1), '')
  )
  FROM auth.users u WHERE u.id = _user;
$$;
REVOKE EXECUTE ON FUNCTION public.cart_club_naam(UUID) FROM PUBLIC, anon, authenticated;

-- Wie er in jouw club zit: de eigenaar en alle leden, met jezelf erbij.
-- Ben je nergens lid van, dan is het je eigen club (eventueel alleen jij).
CREATE OR REPLACE FUNCTION public.cart_club_leden()
RETURNS TABLE (user_id UUID, naam TEXT, eigenaar BOOLEAN, jij BOOLEAN, sinds TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH club AS (
    SELECT COALESCE(
      (SELECT m.owner_id FROM public.shared_list_members m
        WHERE m.member_id = auth.uid() AND m.owner_id <> auth.uid()
        ORDER BY m.created_at LIMIT 1),
      auth.uid()
    ) AS owner_id
  ),
  leden AS (
    SELECT club.owner_id AS user_id, NULL::timestamptz AS sinds FROM club
    UNION
    SELECT m.member_id, min(m.created_at) FROM public.shared_list_members m, club
     WHERE m.owner_id = club.owner_id AND m.member_id <> club.owner_id
     GROUP BY m.member_id
  )
  SELECT l.user_id, public.cart_club_naam(l.user_id), l.user_id = club.owner_id,
         l.user_id = auth.uid(), l.sinds
    FROM leden l, club
   WHERE auth.uid() IS NOT NULL
   ORDER BY (l.user_id = club.owner_id) DESC, l.sinds;
$$;
REVOKE EXECUTE ON FUNCTION public.cart_club_leden() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cart_club_leden() TO authenticated;

-- Wat de uitnodiging laat zien vóór je instapt: wie je uitnodigt en hoeveel
-- mensen er al in zitten. Ook zonder sessie, zodat een gast pas een account
-- krijgt als hij echt instapt. De code zelf is het geheim; alleen een naam en
-- een aantal komen terug.
CREATE OR REPLACE FUNCTION public.cart_club_uitnodiging(_share_code TEXT)
RETURNS TABLE (eigenaar_naam TEXT, leden INTEGER, al_lid BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.cart_club_naam(s.user_id),
         1 + (SELECT count(DISTINCT m.member_id)::int FROM public.shared_list_members m
               WHERE m.owner_id = s.user_id AND m.member_id <> s.user_id),
         auth.uid() IS NOT NULL AND (s.user_id = auth.uid() OR EXISTS (
           SELECT 1 FROM public.shared_list_members m
            WHERE m.owner_id = s.user_id AND m.member_id = auth.uid()))
    FROM public.shared_lists s
   WHERE s.share_code = lower(_share_code) AND s.user_id IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.cart_club_uitnodiging(TEXT) TO anon, authenticated;

-- Je zit in één club tegelijk. Stap je in een andere, dan stap je uit de oude;
-- anders bleef de app stil op de oudste club draaien (household_of en
-- useHousehold nemen het eerste lidmaatschap).
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

  SELECT * INTO _list FROM public.shared_lists WHERE share_code = lower(_share_code);
  IF NOT FOUND OR _list.user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF _list.user_id <> auth.uid() THEN
    DELETE FROM public.shared_list_members
     WHERE member_id = auth.uid() AND owner_id NOT IN (_list.user_id, auth.uid());
  END IF;

  INSERT INTO public.shared_list_members (list_id, owner_id, member_id)
  VALUES (_list.id, _list.user_id, auth.uid())
  ON CONFLICT (list_id, member_id) DO NOTHING;

  RETURN _list.user_id;
END;
$$;
