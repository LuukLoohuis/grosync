-- CoupleCart: volledig schema, idempotent.
-- Draai dit in Supabase Dashboard > SQL Editor. Alles wat al bestaat wordt
-- overgeslagen, dus het script is veilig op zowel een leeg als een half
-- gevuld project. Het laat bestaande data ongemoeid.

BEGIN;

-- ============================================================
-- Tabellen
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shared_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_code TEXT NOT NULL UNIQUE DEFAULT substr(gen_random_uuid()::text, 1, 8),
  name TEXT NOT NULL DEFAULT 'Grocery List',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.shared_lists
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.shared_grocery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.shared_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  from_recipe TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grocery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  from_recipe TEXT,
  price NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.grocery_items ADD COLUMN IF NOT EXISTS price NUMERIC;

CREATE TABLE IF NOT EXISTS public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  ingredients TEXT[] NOT NULL DEFAULT '{}',
  instructions TEXT,
  image_url TEXT,
  source_url TEXT,
  macros JSONB,
  servings INTEGER DEFAULT 4,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS macros JSONB;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS servings INTEGER DEFAULT 4;
COMMENT ON COLUMN public.recipes.macros IS 'Macro nutrients: {calories, protein, carbs, fat, fiber} - all numeric values';

CREATE TABLE IF NOT EXISTS public.usuals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  purchase_count INTEGER NOT NULL DEFAULT 1,
  last_purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_name)
);

CREATE TABLE IF NOT EXISTS public.meal_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  day_index INTEGER NOT NULL CHECK (day_index >= 0 AND day_index <= 6),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
  custom_meal_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start, day_index, meal_type)
);

-- ============================================================
-- Row level security
-- ============================================================

ALTER TABLE public.shared_lists         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_grocery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grocery_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuals               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_plans           ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Security definer functies
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_has_shared_list(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shared_lists WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_valid_shared_list(_list_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shared_lists WHERE id = _list_id)
$$;

-- Bestaat mogelijk al met een andere returnvorm; CREATE OR REPLACE mag die
-- niet wijzigen, dus eerst droppen. Deze functie wordt door geen enkele
-- policy gebruikt, alleen door de app via RPC.
DROP FUNCTION IF EXISTS public.get_shared_list_by_code(TEXT);

CREATE OR REPLACE FUNCTION public.get_shared_list_by_code(_share_code TEXT)
RETURNS TABLE(id UUID, user_id UUID, name TEXT, share_code TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, user_id, name, share_code, created_at
  FROM public.shared_lists
  WHERE shared_lists.share_code = _share_code
  LIMIT 1;
$$;

-- ============================================================
-- Policies (eerst weg, dan opnieuw: zo is het script herhaalbaar)
-- ============================================================

DROP POLICY IF EXISTS "Owner can view own shared lists" ON public.shared_lists;
DROP POLICY IF EXISTS "Anyone can create shared lists"  ON public.shared_lists;
CREATE POLICY "Owner can view own shared lists" ON public.shared_lists
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Anyone can create shared lists" ON public.shared_lists
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Access items of valid shared lists" ON public.shared_grocery_items;
DROP POLICY IF EXISTS "Add items to valid shared lists"    ON public.shared_grocery_items;
DROP POLICY IF EXISTS "Update items in valid shared lists" ON public.shared_grocery_items;
DROP POLICY IF EXISTS "Delete items from valid shared lists" ON public.shared_grocery_items;
CREATE POLICY "Access items of valid shared lists" ON public.shared_grocery_items
  FOR SELECT USING (public.is_valid_shared_list(list_id));
CREATE POLICY "Add items to valid shared lists" ON public.shared_grocery_items
  FOR INSERT WITH CHECK (public.is_valid_shared_list(list_id));
CREATE POLICY "Update items in valid shared lists" ON public.shared_grocery_items
  FOR UPDATE USING (public.is_valid_shared_list(list_id));
CREATE POLICY "Delete items from valid shared lists" ON public.shared_grocery_items
  FOR DELETE USING (public.is_valid_shared_list(list_id));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['grocery_items', 'recipes', 'usuals', 'purchase_history', 'meal_plans'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Owner full access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Shared list access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Owner full access" ON public.%I FOR ALL TO public
         USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE format(
      'CREATE POLICY "Shared list access" ON public.%I FOR ALL TO public
         USING (public.user_has_shared_list(user_id))
         WITH CHECK (public.user_has_shared_list(user_id))', t);
  END LOOP;
END $$;

-- ============================================================
-- Realtime
-- ============================================================

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['shared_grocery_items', 'grocery_items', 'recipes', 'usuals', 'meal_plans'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- Gedeelde lijsten: lidmaatschap
-- ============================================================

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

-- ============================================================
-- Migratiegeschiedenis, zodat de Supabase CLI weet wat gedraaid is
-- ============================================================

CREATE SCHEMA IF NOT EXISTS supabase_migrations;
CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
  version text NOT NULL PRIMARY KEY,
  statements text[],
  name text
);
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('20260216173038', '9bc43c70-6020-4acd-8915-cf443cfa5fff'),
  ('20260216181924', '922c014b-eb07-4cdf-aab1-dd9bf6813844'),
  ('20260217100406', 'f31c89e5-f129-44eb-8fc3-087bafe2f6c6'),
  ('20260217105114', '68d58177-eeae-406c-bb5b-6caa5497fb90'),
  ('20260217111247', '7ed73012-ca58-4ef1-ac36-7e934a4b4bb0'),
  ('20260217123238', '9481acac-bfcb-4b93-ac5e-50205e529bcb'),
  ('20260217124234', 'ae05a94f-4fb5-45b8-9a0d-ab208a02fae3'),
  ('20260217132206', 'f99c256e-fdc3-49ae-8c64-f872ee7300f7'),
  ('20260218114219', 'fe825c50-1c41-4f1c-9c3f-109b683e521f'),
  ('20260218120804', 'ddff2578-6497-4145-be0c-9eff8466fe5f'),
  ('20260218122706', '1d33aa7f-a7d7-4f3f-95ab-281a47e0af9a'),
  ('20260222172908', 'e494bc53-e7ae-4b03-a7ed-4299b9c14df9'),
  ('20260310195615', 'a8834e44-e31b-4b8c-bc81-ffbe94d9a643'),
  ('20260310201828', 'e5d7fc4e-2b87-4801-ae9c-3d0ede7e093a'),
  ('20260311183339', '998fe14d-ff3f-475b-8a42-99593ad3d0c6'),
  ('20260311190944', 'e6d4707c-2c1d-41fa-bf7a-d3451b07900b'),
  ('20260909190000', 'gedeelde_lijst_lidmaatschap')
ON CONFLICT (version) DO NOTHING;

COMMIT;

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

-- Afdeling die AH zelf opgeeft voor het gekozen product, zodat de lijst per
-- afdeling kan sorteren zoals in de winkel.
ALTER TABLE public.grocery_items ADD COLUMN IF NOT EXISTS ah_category TEXT;

-- "Stop met delen": de eigenaar mag zijn deellijst verwijderen. De leden in
-- shared_list_members verdwijnen dan mee (ON DELETE CASCADE), zodat niemand
-- nog bij de lijst kan. Een nieuwe deellink krijgt een nieuwe code.
DROP POLICY IF EXISTS "Eigenaar verwijdert deellijst" ON public.shared_lists;
CREATE POLICY "Eigenaar verwijdert deellijst" ON public.shared_lists
  FOR DELETE USING (user_id = auth.uid());

-- De bonus van Albert Heijn, één keer opgehaald voor iedereen samen.
-- Alleen de edge function schrijft (die draait met de service role en gaat langs RLS);
-- iedereen die ingelogd is, mag lezen.
CREATE TABLE IF NOT EXISTS public.bonus_products (
  product_id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  unit_size TEXT,
  category TEXT,
  mechanism TEXT,
  price NUMERIC,
  price_before NUMERIC,
  start_date DATE,
  end_date DATE,
  image_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bonus_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ingelogd leest de bonus" ON public.bonus_products;
CREATE POLICY "Ingelogd leest de bonus" ON public.bonus_products
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS bonus_products_fetched_at_idx ON public.bonus_products (fetched_at DESC);

-- ============================================================
-- Recepten indelen in categorieën
-- ============================================================


ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS categories TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.recipe_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'groen',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS recipe_categories_user_idx ON public.recipe_categories (user_id);

ALTER TABLE public.recipe_categories ENABLE ROW LEVEL SECURITY;

-- Zelfde toegang als de recepten zelf: eigenaar, plus wie de lijst deelt.
DROP POLICY IF EXISTS "Owner full access" ON public.recipe_categories;
CREATE POLICY "Owner full access" ON public.recipe_categories FOR ALL TO public
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Shared list access" ON public.recipe_categories;
CREATE POLICY "Shared list access" ON public.recipe_categories FOR ALL TO public
  USING (public.has_shared_access(user_id)) WITH CHECK (public.has_shared_access(user_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'recipe_categories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recipe_categories;
  END IF;
END $$;

-- ============================================================
-- Voorraadkast
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pantry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'ruim' CHECK (level IN ('ruim', 'bijna', 'op')),
  -- Waar het vandaan kwam: foto, afgevinkte boodschap of met de hand.
  source TEXT NOT NULL DEFAULT 'handmatig',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Eén regel per product per huishouden, ongeacht hoofdletters.
CREATE UNIQUE INDEX IF NOT EXISTS pantry_items_user_name_idx ON public.pantry_items (user_id, lower(name));

ALTER TABLE public.pantry_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner full access" ON public.pantry_items;
CREATE POLICY "Owner full access" ON public.pantry_items FOR ALL TO public
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Shared list access" ON public.pantry_items;
CREATE POLICY "Shared list access" ON public.pantry_items FOR ALL TO public
  USING (public.has_shared_access(user_id)) WITH CHECK (public.has_shared_access(user_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pantry_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pantry_items;
  END IF;
END $$;

ALTER TABLE public.pantry_items ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.pantry_items ADD COLUMN IF NOT EXISTS low BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'pantry_items' AND column_name = 'level') THEN
    -- Wat "op" was heeft er nul staan, wat "bijna" was krijgt de vlag.
    UPDATE public.pantry_items
       SET quantity = CASE WHEN level = 'op' THEN 0 ELSE 1 END,
           low = (level = 'bijna');
    -- De kolom blijft staan met een standaardwaarde, zodat een telefoon die de
    -- oude versie nog draait niets stukmaakt.
    ALTER TABLE public.pantry_items ALTER COLUMN level DROP NOT NULL;
    ALTER TABLE public.pantry_items ALTER COLUMN level SET DEFAULT 'ruim';
  END IF;
END $$;

ALTER TABLE public.pantry_items DROP CONSTRAINT IF EXISTS pantry_items_quantity_check;
ALTER TABLE public.pantry_items ADD CONSTRAINT pantry_items_quantity_check CHECK (quantity >= 0 AND quantity <= 99);

-- ============================================================
-- Plus, de gebruiksmeter en het beheerdersoverzicht
-- ============================================================
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

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Beheerder leest instellingen" ON public.app_settings;
CREATE POLICY "Beheerder leest instellingen" ON public.app_settings
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Beheerder zet instellingen" ON public.app_settings;
CREATE POLICY "Beheerder zet instellingen" ON public.app_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Leeg betekent: gebruik wat er in de omgeving staat (OpenAI, tenzij anders gezet).
INSERT INTO public.app_settings (key, value)
VALUES ('ai', '{"provider": "", "text_model": "", "scan_model": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.grocery_items ADD COLUMN IF NOT EXISTS price_before NUMERIC;

ALTER TABLE public.plus_members ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.plus_members ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE public.plus_members ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.plus_members ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS plus_members_klant_idx ON public.plus_members (stripe_customer_id);

-- Stripe stuurt een gebeurtenis soms twee keer; verwerkte gebeurtenissen
-- onthouden we, zodat een herhaling niets dubbel doet.
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Niemand leest dit vanuit de app; alleen de webhook schrijft, met de service role.
DROP POLICY IF EXISTS "Beheerder leest gebeurtenissen" ON public.stripe_events;
CREATE POLICY "Beheerder leest gebeurtenissen" ON public.stripe_events
  FOR SELECT USING (public.is_admin());
-- Een recept als favoriet markeren, met een hartje in het overzicht.
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT false;

-- Favorieten staan vooraan; deze index houdt dat goedkoop.
CREATE INDEX IF NOT EXISTS recipes_favorite_idx ON public.recipes (user_id, favorite);

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
