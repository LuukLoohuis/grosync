-- Gratis krijgt elke maand vijf recepten en vijf kastfoto's; Plus krijgt alles.
-- De teller staat in de database, niet in de app, want de app is te vertrouwen
-- noch te controleren.

-- ============================================================
-- Wie is er Plus, en wie is beheerder
-- ============================================================

CREATE TABLE IF NOT EXISTS public.plus_members (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'admin',
  note TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.admins (user_id)
SELECT id FROM auth.users WHERE lower(email) = 'luuk.loohuis@gmail.com'
ON CONFLICT DO NOTHING;

-- ============================================================
-- De meter
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  period TEXT NOT NULL,           -- 'JJJJ-MM' in Nederlandse tijd
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature, period)
);

CREATE INDEX IF NOT EXISTS ai_usage_period_idx ON public.ai_usage (period, feature);

ALTER TABLE public.plus_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage     ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_plus(_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.plus_members
    WHERE user_id = _user AND (expires_at IS NULL OR expires_at > now())
  );
$$;

-- Je ziet je eigen stand; verder niemand, behalve de beheerder.
DROP POLICY IF EXISTS "Eigen plus zien" ON public.plus_members;
CREATE POLICY "Eigen plus zien" ON public.plus_members
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Eigen verbruik zien" ON public.ai_usage;
CREATE POLICY "Eigen verbruik zien" ON public.ai_usage
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Beheerders zien elkaar" ON public.admins;
CREATE POLICY "Beheerders zien elkaar" ON public.admins
  FOR SELECT USING (public.is_admin());

-- ============================================================
-- Tellen en toestaan, in één stap
-- ============================================================

-- Alleen de edge functions (service role) roepen dit aan: de app zelf mag niet
-- over zijn eigen tegoed beslissen.
CREATE OR REPLACE FUNCTION public.consume_ai(_user UUID, _feature TEXT, _limit INTEGER)
RETURNS TABLE(allowed BOOLEAN, used INTEGER, quota INTEGER, plus BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _period TEXT := to_char(now() AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM');
  _plus BOOLEAN := public.is_plus(_user);
  _count INTEGER;
BEGIN
  SELECT count INTO _count FROM public.ai_usage
   WHERE user_id = _user AND feature = _feature AND period = _period;
  _count := COALESCE(_count, 0);

  -- Op is op: de poging zelf telt niet mee, anders blijft de teller oplopen.
  IF NOT _plus AND _count >= _limit THEN
    RETURN QUERY SELECT false, _count, _limit, false;
    RETURN;
  END IF;

  INSERT INTO public.ai_usage (user_id, feature, period, count)
  VALUES (_user, _feature, _period, 1)
  ON CONFLICT (user_id, feature, period)
  DO UPDATE SET count = public.ai_usage.count + 1, updated_at = now()
  RETURNING count INTO _count;

  RETURN QUERY SELECT true, _count, CASE WHEN _plus THEN -1 ELSE _limit END, _plus;
END $$;

REVOKE ALL ON FUNCTION public.consume_ai(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Beheerdersoverzicht
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
      WHERE u.period = _period AND u.count >= 5 AND NOT public.is_plus(u.user_id)
    )
  ) INTO _out;

  RETURN _out;
END $$;

-- Verbruik per maand, om een prijs op te kunnen baseren.
CREATE OR REPLACE FUNCTION public.admin_usage(_months INTEGER DEFAULT 6)
RETURNS TABLE(period TEXT, feature TEXT, acties BIGINT, gebruikers BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Geen toegang'; END IF;
  RETURN QUERY
    SELECT u.period, u.feature, sum(u.count)::bigint, count(DISTINCT u.user_id)::bigint
    FROM public.ai_usage u
    WHERE u.period >= to_char((now() AT TIME ZONE 'Europe/Amsterdam') - make_interval(months => _months), 'YYYY-MM')
    GROUP BY u.period, u.feature
    ORDER BY u.period DESC, u.feature;
END $$;

-- De gebruikerslijst: wie het zijn, wat ze doen, en of ze Plus hebben.
CREATE OR REPLACE FUNCTION public.admin_users(_search TEXT DEFAULT NULL, _limit INTEGER DEFAULT 50)
RETURNS TABLE(
  user_id UUID, email TEXT, is_gast BOOLEAN, aangemaakt TIMESTAMPTZ, laatst_gezien TIMESTAMPTZ,
  plus BOOLEAN, recepten BIGINT, lijstitems BIGINT, voorraad BIGINT, acties_deze_maand BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _period TEXT := to_char(now() AT TIME ZONE 'Europe/Amsterdam', 'YYYY-MM');
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Geen toegang'; END IF;
  RETURN QUERY
    SELECT
      au.id,
      COALESCE(au.email, '')::text,
      (au.email IS NULL),
      au.created_at,
      au.last_sign_in_at,
      public.is_plus(au.id),
      (SELECT count(*) FROM public.recipes r WHERE r.user_id = au.id),
      (SELECT count(*) FROM public.grocery_items g WHERE g.user_id = au.id),
      (SELECT count(*) FROM public.pantry_items p WHERE p.user_id = au.id),
      COALESCE((SELECT sum(x.count) FROM public.ai_usage x WHERE x.user_id = au.id AND x.period = _period), 0)::bigint
    FROM auth.users au
    WHERE _search IS NULL OR _search = '' OR au.email ILIKE '%' || _search || '%'
    ORDER BY au.last_sign_in_at DESC NULLS LAST
    LIMIT GREATEST(1, LEAST(_limit, 200));
END $$;

-- Plus aan- of uitzetten voor iemand.
CREATE OR REPLACE FUNCTION public.admin_set_plus(_user UUID, _on BOOLEAN, _note TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Geen toegang'; END IF;
  IF _on THEN
    INSERT INTO public.plus_members (user_id, source, note)
    VALUES (_user, 'admin', _note)
    ON CONFLICT (user_id) DO UPDATE SET expires_at = NULL, note = COALESCE(_note, public.plus_members.note);
  ELSE
    DELETE FROM public.plus_members WHERE user_id = _user;
  END IF;
  RETURN _on;
END $$;
