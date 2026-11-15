-- Plus is van wie betaalt, niet van het huishouden. Wie in een Cart Club zit
-- met iemand die Plus heeft, krijgt het daar niet meer automatisch bij.
-- De gratis teller blijft per huishouden (anders brengt elk lid drie nieuwe mee),
-- maar wat een Plus-lid doet telt daar niet meer op: dat zou de rest van de club
-- hun gratis tegoed afnemen. Plus-gebruik krijgt een eigen rij, zodat het
-- beheerdersoverzicht het nog wel ziet.

CREATE OR REPLACE FUNCTION public.is_plus(_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plus_members
    WHERE user_id = _user AND (expires_at IS NULL OR expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.consume_ai(_user UUID, _feature TEXT, _limit INTEGER)
RETURNS TABLE(allowed BOOLEAN, used INTEGER, quota INTEGER, plus BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _period TEXT := to_char(now() AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM');
  _owner UUID := public.household_of(_user);
  _plus BOOLEAN := public.is_plus(_user);
  _count INTEGER;
BEGIN
  IF _plus THEN
    INSERT INTO public.ai_usage AS u (user_id, feature, period, count)
    VALUES (_user, _feature || ':plus', _period, 1)
    ON CONFLICT (user_id, feature, period)
    DO UPDATE SET count = u.count + 1, updated_at = now()
    RETURNING u.count INTO _count;
    RETURN QUERY SELECT true, _count, -1, true;
    RETURN;
  END IF;

  INSERT INTO public.ai_usage AS u (user_id, feature, period, count)
  SELECT _owner, _feature, _period, 1
  WHERE _limit > 0
  ON CONFLICT (user_id, feature, period)
  DO UPDATE SET count = u.count + 1, updated_at = now()
  WHERE u.count < _limit
  RETURNING u.count INTO _count;

  IF _count IS NULL THEN
    SELECT u.count INTO _count FROM public.ai_usage u
     WHERE u.user_id = _owner AND u.feature = _feature AND u.period = _period;
    RETURN QUERY SELECT false, COALESCE(_count, 0), _limit, false;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, _count, _limit, false;
END $$;

REVOKE ALL ON FUNCTION public.consume_ai(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;

-- Alleen de gratis tellers van het huishouden; de Plus-rijen zijn voor het overzicht.
CREATE OR REPLACE FUNCTION public.my_usage()
RETURNS TABLE(feature TEXT, count INTEGER)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.feature, u.count FROM public.ai_usage u
   WHERE u.user_id = public.household_of(auth.uid())
     AND u.feature NOT LIKE '%:plus'
     AND u.period = to_char(now() AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM');
$$;

REVOKE ALL ON FUNCTION public.my_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_usage() TO authenticated;
