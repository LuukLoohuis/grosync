-- Beveiliging (audit 2026-11-15).
--
-- 1. De oude tabel shared_grocery_items (uit de Lovable-tijd, leeg en nergens
--    meer gebruikt) had regels die alleen keken of de lijst bestond: iedereen,
--    ook zonder in te loggen, kon er lezen en schrijven. Weg ermee, en met de
--    hulpfuncties die alleen daarvoor bestonden.
-- 2. Functies die niemand zonder login nodig heeft, zijn niet meer voor anon.
-- 3. Cart Club-codes worden 12 tekens (48 bits) in plaats van 8 (32 bits), zodat
--    ze niet meer te raden zijn. Bestaande codes krijgen een nieuwe; leden blijven lid.

-- 1 ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime DROP TABLE public.shared_grocery_items;
DROP TABLE IF EXISTS public.shared_grocery_items;
DROP FUNCTION IF EXISTS public.is_valid_shared_list(uuid);
DROP FUNCTION IF EXISTS public.get_shared_list_by_code(text);
DROP FUNCTION IF EXISTS public.user_has_shared_list(uuid);

-- 2 ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.admin_overview() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_plus(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_usage(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_users(text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_plus(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_plus() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_shared_list(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_plus(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_usage(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_users(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_plus(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_plus() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_shared_list(text) TO authenticated;

-- 3 ---------------------------------------------------------------------------
ALTER TABLE public.shared_lists
  ALTER COLUMN share_code SET DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

UPDATE public.shared_lists
   SET share_code = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
 WHERE length(share_code) < 12;
