-- Cart Club: wie een uitnodiging gebruikt, vraagt om erbij te mogen; de
-- oprichter laat toe of weigert. Tot nu toe was de code genoeg om meteen lid te
-- worden en de lijst, voorraad, recepten en instellingen van de oprichter te
-- bewerken. Een gelekte of geraden code geeft nu hooguit een aanvraag.

CREATE TABLE IF NOT EXISTS public.club_aanvragen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id UUID NOT NULL REFERENCES public.shared_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, user_id)
);
ALTER TABLE public.club_aanvragen ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.club_aanvragen FROM anon, authenticated;
GRANT SELECT ON public.club_aanvragen TO authenticated;
-- Lezen: de oprichter zijn aanvragen, de aanvrager de eigen. Schrijven alleen via de functies hieronder.
CREATE POLICY "Eigen aanvragen zien" ON public.club_aanvragen
  FOR SELECT TO authenticated USING (owner_id = auth.uid() OR user_id = auth.uid());

-- Hoeveel open aanvragen een club hooguit heeft, en hoe lang ze blijven staan.
-- Zo kan niemand met een code de lijst van de oprichter volspammen.
CREATE OR REPLACE FUNCTION public.club_aanvragen_opruimen(_owner UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.club_aanvragen
   WHERE owner_id = _owner AND created_at < now() - interval '7 days';
$$;
REVOKE EXECUTE ON FUNCTION public.club_aanvragen_opruimen(UUID) FROM PUBLIC, anon, authenticated;

-- Wie een uitnodiging opent: 'lid' (al lid of de oprichter zelf), 'wacht'
-- (aanvraag staat, of is net gedaan), 'vol' (te veel open aanvragen) of
-- 'onbekend' (geen geldige code).
CREATE OR REPLACE FUNCTION public.vraag_toegang(_share_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _list public.shared_lists%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Inloggen is vereist';
  END IF;

  SELECT * INTO _list FROM public.shared_lists WHERE share_code = lower(_share_code);
  IF NOT FOUND OR _list.user_id IS NULL THEN
    RETURN 'onbekend';
  END IF;

  IF _list.user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.shared_list_members m
     WHERE m.owner_id = _list.user_id AND m.member_id = auth.uid()
  ) THEN
    RETURN 'lid';
  END IF;

  PERFORM public.club_aanvragen_opruimen(_list.user_id);

  IF EXISTS (SELECT 1 FROM public.club_aanvragen a WHERE a.owner_id = _list.user_id AND a.user_id = auth.uid()) THEN
    RETURN 'wacht';
  END IF;

  IF (SELECT count(*) FROM public.club_aanvragen a WHERE a.owner_id = _list.user_id) >= 10 THEN
    RETURN 'vol';
  END IF;

  INSERT INTO public.club_aanvragen (owner_id, list_id, user_id)
  VALUES (_list.user_id, _list.id, auth.uid())
  ON CONFLICT (owner_id, user_id) DO NOTHING;
  RETURN 'wacht';
END;
$$;
REVOKE EXECUTE ON FUNCTION public.vraag_toegang(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vraag_toegang(TEXT) TO authenticated;

-- Oude versies van de app roepen nog join_shared_list aan. Die maakt nu ook
-- alleen een aanvraag, en geeft de oprichter pas terug als je al lid bent.
CREATE OR REPLACE FUNCTION public.join_shared_list(_share_code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.vraag_toegang(_share_code) <> 'lid' THEN
    RETURN NULL;
  END IF;
  RETURN (SELECT user_id FROM public.shared_lists WHERE share_code = lower(_share_code));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.join_shared_list(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_shared_list(TEXT) TO authenticated;

-- De uitnodiging vóór het instappen, nu ook met of je al een aanvraag hebt lopen.
DROP FUNCTION IF EXISTS public.cart_club_uitnodiging(TEXT);
CREATE FUNCTION public.cart_club_uitnodiging(_share_code TEXT)
RETURNS TABLE (eigenaar_naam TEXT, leden INTEGER, al_lid BOOLEAN, aangevraagd BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.cart_club_naam(s.user_id),
         1 + (SELECT count(DISTINCT m.member_id)::int FROM public.shared_list_members m
               WHERE m.owner_id = s.user_id AND m.member_id <> s.user_id),
         auth.uid() IS NOT NULL AND (s.user_id = auth.uid() OR EXISTS (
           SELECT 1 FROM public.shared_list_members m
            WHERE m.owner_id = s.user_id AND m.member_id = auth.uid())),
         auth.uid() IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.club_aanvragen a
            WHERE a.owner_id = s.user_id AND a.user_id = auth.uid())
    FROM public.shared_lists s
   WHERE s.share_code = lower(_share_code) AND s.user_id IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.cart_club_uitnodiging(TEXT) TO anon, authenticated;

-- Wie er op de oprichter wacht, met naam (een gast heeft er geen).
CREATE OR REPLACE FUNCTION public.cart_club_aanvragen()
RETURNS TABLE (user_id UUID, naam TEXT, sinds TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.user_id, public.cart_club_naam(a.user_id), a.created_at
    FROM public.club_aanvragen a
   WHERE a.owner_id = auth.uid() AND a.created_at > now() - interval '7 days'
   ORDER BY a.created_at;
$$;
REVOKE EXECUTE ON FUNCTION public.cart_club_aanvragen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cart_club_aanvragen() TO authenticated;

-- De oprichter laat iemand toe. Zoals voorheen bij instappen: je zit in één club
-- tegelijk, dus het nieuwe lid stapt uit een andere club waar het in zat.
CREATE OR REPLACE FUNCTION public.laat_lid_toe(_user UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _aanvraag public.club_aanvragen%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inloggen is vereist'; END IF;

  SELECT * INTO _aanvraag FROM public.club_aanvragen
   WHERE owner_id = auth.uid() AND user_id = _user AND created_at > now() - interval '7 days';
  IF NOT FOUND THEN RETURN false; END IF;

  DELETE FROM public.shared_list_members
   WHERE member_id = _user AND owner_id NOT IN (auth.uid(), _user);

  INSERT INTO public.shared_list_members (list_id, owner_id, member_id)
  VALUES (_aanvraag.list_id, auth.uid(), _user)
  ON CONFLICT (list_id, member_id) DO NOTHING;

  DELETE FROM public.club_aanvragen WHERE id = _aanvraag.id;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.laat_lid_toe(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.laat_lid_toe(UUID) TO authenticated;

-- Weigeren (door de oprichter) of intrekken (door wie wacht).
CREATE OR REPLACE FUNCTION public.weiger_aanvraag(_user UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.club_aanvragen WHERE owner_id = auth.uid() AND user_id = _user;
$$;
REVOKE EXECUTE ON FUNCTION public.weiger_aanvraag(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.weiger_aanvraag(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.trek_aanvraag_in(_share_code TEXT)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.club_aanvragen a
   USING public.shared_lists s
   WHERE s.share_code = lower(_share_code) AND a.owner_id = s.user_id AND a.user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.trek_aanvraag_in(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trek_aanvraag_in(TEXT) TO authenticated;
