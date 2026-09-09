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
