-- Gratis wordt drie per maand, en het karretje vullen bij AH telt nu ook mee.
-- De teller hoort bij het huishouden, net als Plus: een lijst delen kan met
-- onbeperkt veel mensen, en anders bracht elke meedoener drie nieuwe mee.
-- De grens zelf staat in de edge functions (FREE_LIMIT); hier alleen de telling.

-- ============================================================
-- Bij welk huishouden hoor je
-- ============================================================

-- Dezelfde keuze als de app maakt (useHousehold): de eerste koppeling waar je
-- lid van bent, en anders jezelf.
CREATE OR REPLACE FUNCTION public.household_of(_user UUID)
RETURNS UUID LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.shared_list_members
      WHERE member_id = _user AND owner_id <> _user
      ORDER BY created_at ASC
      LIMIT 1),
    _user
  );
$$;

-- Alleen voor de functies hieronder; niemand hoeft andermans koppeling op te vragen.
REVOKE ALL ON FUNCTION public.household_of(UUID) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Tellen en toestaan, per huishouden
-- ============================================================

-- Eén statement telt en toetst tegelijk, zodat twee tikken vlak na elkaar niet
-- samen over de grens heen komen. Op is op: de geweigerde poging telt niet mee.
CREATE OR REPLACE FUNCTION public.consume_ai(_user UUID, _feature TEXT, _limit INTEGER)
RETURNS TABLE(allowed BOOLEAN, used INTEGER, quota INTEGER, plus BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _period TEXT := to_char(now() AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM');
  _owner UUID := public.household_of(_user);
  _plus BOOLEAN := public.is_plus(_user);
  _count INTEGER;
BEGIN
  INSERT INTO public.ai_usage AS u (user_id, feature, period, count)
  SELECT _owner, _feature, _period, 1
  WHERE _plus OR _limit > 0
  ON CONFLICT (user_id, feature, period)
  DO UPDATE SET count = u.count + 1, updated_at = now()
  WHERE _plus OR u.count < _limit
  RETURNING u.count INTO _count;

  IF _count IS NULL THEN
    SELECT u.count INTO _count FROM public.ai_usage u
     WHERE u.user_id = _owner AND u.feature = _feature AND u.period = _period;
    RETURN QUERY SELECT false, COALESCE(_count, 0), _limit, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, _count, CASE WHEN _plus THEN -1 ELSE _limit END, _plus;
END $$;

REVOKE ALL ON FUNCTION public.consume_ai(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;

-- Lukte het werk daarna niet (AH plat, geen verbinding), dan krijg je die ene
-- keer terug. Bij drie per maand voelt een mislukte poging anders als diefstal.
CREATE OR REPLACE FUNCTION public.release_ai(_user UUID, _feature TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.ai_usage
     SET count = GREATEST(count - 1, 0), updated_at = now()
   WHERE user_id = public.household_of(_user)
     AND feature = _feature
     AND period = to_char(now() AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM');
$$;

REVOKE ALL ON FUNCTION public.release_ai(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Wat de app laat zien
-- ============================================================

-- De stand van deze maand voor jouw huishouden. Een lid mag de rij van de
-- eigenaar niet zelf lezen, dus dit gaat via de server.
CREATE OR REPLACE FUNCTION public.my_usage()
RETURNS TABLE(feature TEXT, count INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.feature, u.count FROM public.ai_usage u
   WHERE u.user_id = public.household_of(auth.uid())
     AND u.period = to_char(now() AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM');
$$;

REVOKE ALL ON FUNCTION public.my_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_usage() TO authenticated;

-- ============================================================
-- Beheerdersoverzicht: de grens is nu drie
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _period TEXT := to_char(now() AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM');
  _out JSONB;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Geen toegang'; END IF;

  SELECT jsonb_build_object(
    'periode', _period,
    'huishoudens', (SELECT count(*) FROM auth.users),
    'nieuw_7d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days'),
    'nieuw_30d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '30 days'),
    'actief_7d', (SELECT count(*) FROM auth.users WHERE last_sign_in_at > now() - interval '7 days'),
    'actief_30d', (SELECT count(*) FROM auth.users WHERE last_sign_in_at > now() - interval '30 days'),
    'plus_leden', (SELECT count(*) FROM public.plus_members WHERE expires_at IS NULL OR expires_at > now()),
    'delende_huishoudens', (SELECT count(DISTINCT owner_id) FROM public.shared_list_members),
    'recepten', (SELECT count(*) FROM public.recipes),
    'lijstitems', (SELECT count(*) FROM public.grocery_items),
    'voorraaditems', (SELECT count(*) FROM public.pantry_items),
    'acties_deze_maand', (
      SELECT COALESCE(jsonb_object_agg(feature, acties), '{}'::jsonb)
      FROM (SELECT feature, sum(count) AS acties FROM public.ai_usage WHERE period = _period GROUP BY feature) f
    ),
    'gebruikers_met_acties', (SELECT count(DISTINCT user_id) FROM public.ai_usage WHERE period = _period),
    'op_hun_limiet', (
      SELECT count(DISTINCT u.user_id) FROM public.ai_usage u
      WHERE u.period = _period AND u.count >= 3 AND NOT public.is_plus(u.user_id)
    )
  ) INTO _out;

  RETURN _out;
END $$;
