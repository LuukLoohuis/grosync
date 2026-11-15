-- De foto-teller van fetch-url-meta (imageOnly, eigen limiet van 50) telt niet
-- mee als "op hun limiet" in het beheerscherm; die limiet is voor AI-acties (3).
CREATE OR REPLACE FUNCTION public.admin_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      WHERE u.period = _period AND u.feature <> 'foto' AND u.count >= 3 AND NOT public.is_plus(u.user_id)
    )
  ) INTO _out;

  RETURN _out;
END $function$;
