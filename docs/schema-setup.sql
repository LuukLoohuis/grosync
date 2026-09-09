-- CoupleCart: volledig schema, gegenereerd uit supabase/migrations/
-- Plak dit in Supabase Dashboard > SQL Editor > New query > Run.
-- Onderaan worden de migraties als 'uitgevoerd' geregistreerd zodat
-- de Supabase CLI later niet opnieuw probeert te pushen.

BEGIN;

-- ===== 20260216173038_9bc43c70-6020-4acd-8915-cf443cfa5fff.sql =====
-- Shared grocery lists
CREATE TABLE public.shared_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_code TEXT NOT NULL UNIQUE DEFAULT substr(gen_random_uuid()::text, 1, 8),
  name TEXT NOT NULL DEFAULT 'Grocery List',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Items in shared lists
CREATE TABLE public.shared_grocery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.shared_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  from_recipe TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shared_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_grocery_items ENABLE ROW LEVEL SECURITY;

-- Public access policies (share_code is the "password")
CREATE POLICY "Anyone can view shared lists" ON public.shared_lists FOR SELECT USING (true);
CREATE POLICY "Anyone can create shared lists" ON public.shared_lists FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view shared items" ON public.shared_grocery_items FOR SELECT USING (true);
CREATE POLICY "Anyone can add items" ON public.shared_grocery_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update items" ON public.shared_grocery_items FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete items" ON public.shared_grocery_items FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_grocery_items;

-- ===== 20260216181924_922c014b-eb07-4cdf-aab1-dd9bf6813844.sql =====
-- Drop the restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Anyone can delete items" ON public.shared_grocery_items;
DROP POLICY IF EXISTS "Anyone can add items" ON public.shared_grocery_items;
DROP POLICY IF EXISTS "Anyone can update items" ON public.shared_grocery_items;
DROP POLICY IF EXISTS "Anyone can view shared items" ON public.shared_grocery_items;

CREATE POLICY "Anyone can view shared items" ON public.shared_grocery_items FOR SELECT USING (true);
CREATE POLICY "Anyone can add items" ON public.shared_grocery_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update items" ON public.shared_grocery_items FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete items" ON public.shared_grocery_items FOR DELETE USING (true);

-- Also fix shared_lists policies
DROP POLICY IF EXISTS "Anyone can create shared lists" ON public.shared_lists;
DROP POLICY IF EXISTS "Anyone can view shared lists" ON public.shared_lists;

CREATE POLICY "Anyone can view shared lists" ON public.shared_lists FOR SELECT USING (true);
CREATE POLICY "Anyone can create shared lists" ON public.shared_lists FOR INSERT WITH CHECK (true);

-- ===== 20260217100406_f31c89e5-f129-44eb-8fc3-087bafe2f6c6.sql =====
-- Create grocery_items table (per user, replaces localStorage)
CREATE TABLE public.grocery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  from_recipe TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.grocery_items ENABLE ROW LEVEL SECURITY;

-- Create recipes table (per user, replaces localStorage)
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  ingredients TEXT[] NOT NULL DEFAULT '{}',
  instructions TEXT,
  image_url TEXT,
  source_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- Add user_id to shared_lists
ALTER TABLE public.shared_lists ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Security definer function to check if a user has a shared list
CREATE OR REPLACE FUNCTION public.user_has_shared_list(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_lists WHERE user_id = _user_id
  )
$$;

-- RLS for grocery_items: owner OR anyone if user has a shared list
CREATE POLICY "Owner can do everything" ON public.grocery_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public access via shared list" ON public.grocery_items
  FOR ALL TO anon
  USING (public.user_has_shared_list(user_id))
  WITH CHECK (public.user_has_shared_list(user_id));

CREATE POLICY "Authenticated shared access" ON public.grocery_items
  FOR ALL TO authenticated
  USING (public.user_has_shared_list(user_id) AND auth.uid() != user_id)
  WITH CHECK (public.user_has_shared_list(user_id) AND auth.uid() != user_id);

-- RLS for recipes: owner OR anyone if user has a shared list
CREATE POLICY "Owner can do everything" ON public.recipes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Public access via shared list" ON public.recipes
  FOR ALL TO anon
  USING (public.user_has_shared_list(user_id))
  WITH CHECK (public.user_has_shared_list(user_id));

CREATE POLICY "Authenticated shared access" ON public.recipes
  FOR ALL TO authenticated
  USING (public.user_has_shared_list(user_id) AND auth.uid() != user_id)
  WITH CHECK (public.user_has_shared_list(user_id) AND auth.uid() != user_id);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.grocery_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipes;

-- ===== 20260217105114_68d58177-eeae-406c-bb5b-6caa5497fb90.sql =====
-- Fix: Change all restrictive policies to permissive (OR logic) for grocery_items
DROP POLICY IF EXISTS "Owner can do everything" ON public.grocery_items;
DROP POLICY IF EXISTS "Authenticated shared access" ON public.grocery_items;
DROP POLICY IF EXISTS "Public access via shared list" ON public.grocery_items;

CREATE POLICY "Owner full access" ON public.grocery_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared list access" ON public.grocery_items FOR ALL
  USING (user_has_shared_list(user_id))
  WITH CHECK (user_has_shared_list(user_id));

-- Fix: Same for recipes
DROP POLICY IF EXISTS "Owner can do everything" ON public.recipes;
DROP POLICY IF EXISTS "Authenticated shared access" ON public.recipes;
DROP POLICY IF EXISTS "Public access via shared list" ON public.recipes;

CREATE POLICY "Owner full access" ON public.recipes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared list access" ON public.recipes FOR ALL
  USING (user_has_shared_list(user_id))
  WITH CHECK (user_has_shared_list(user_id));

-- ===== 20260217111247_7ed73012-ca58-4ef1-ac36-7e934a4b4bb0.sql =====
-- Create usuals table for frequently bought items
CREATE TABLE public.usuals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.usuals ENABLE ROW LEVEL SECURITY;

-- Owner access
CREATE POLICY "Owner full access" ON public.usuals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Shared list access
CREATE POLICY "Shared list access" ON public.usuals FOR ALL
  USING (user_has_shared_list(user_id))
  WITH CHECK (user_has_shared_list(user_id));

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.usuals;

-- ===== 20260217123238_9481acac-bfcb-4b93-ac5e-50205e529bcb.sql =====
-- Fix usuals policies: change from RESTRICTIVE to PERMISSIVE
DROP POLICY "Owner full access" ON public.usuals;
DROP POLICY "Shared list access" ON public.usuals;

CREATE POLICY "Owner full access"
  ON public.usuals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared list access"
  ON public.usuals FOR ALL
  USING (user_has_shared_list(user_id))
  WITH CHECK (user_has_shared_list(user_id));

-- ===== 20260217124234_ae05a94f-4fb5-45b8-9a0d-ab208a02fae3.sql =====
-- Fix grocery_items policies
DROP POLICY IF EXISTS "Owner full access" ON public.grocery_items;
DROP POLICY IF EXISTS "Shared list access" ON public.grocery_items;

CREATE POLICY "Owner full access"
  ON public.grocery_items FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared list access"
  ON public.grocery_items FOR ALL
  USING (user_has_shared_list(user_id))
  WITH CHECK (user_has_shared_list(user_id));

-- Fix recipes policies
DROP POLICY IF EXISTS "Owner full access" ON public.recipes;
DROP POLICY IF EXISTS "Shared list access" ON public.recipes;

CREATE POLICY "Owner full access"
  ON public.recipes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared list access"
  ON public.recipes FOR ALL
  USING (user_has_shared_list(user_id))
  WITH CHECK (user_has_shared_list(user_id));

-- ===== 20260217132206_f99c256e-fdc3-49ae-8c64-f872ee7300f7.sql =====
-- Add macros column to recipes table (JSONB for flexibility)
ALTER TABLE public.recipes
ADD COLUMN macros JSONB DEFAULT NULL;

COMMENT ON COLUMN public.recipes.macros IS 'Macro nutrients: {calories, protein, carbs, fat, fiber} - all numeric values';

-- ===== 20260218114219_fe825c50-1c41-4f1c-9c3f-109b683e521f.sql =====
ALTER TABLE public.recipes ADD COLUMN servings integer DEFAULT 4;

-- ===== 20260218120804_ddff2578-6497-4145-be0c-9eff8466fe5f.sql =====
-- Create RPC to look up shared list by share_code (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.get_shared_list_by_code(_share_code text)
RETURNS TABLE(id uuid, user_id uuid, name text, share_code text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, user_id, name, share_code, created_at
  FROM public.shared_lists
  WHERE shared_lists.share_code = _share_code
  LIMIT 1;
$$;

-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view shared lists" ON public.shared_lists;

-- Create restrictive SELECT policy: only owners can directly query the table
CREATE POLICY "Owner can view own shared lists"
ON public.shared_lists
FOR SELECT
USING (auth.uid() = user_id);

-- ===== 20260218122706_1d33aa7f-a7d7-4f3f-95ab-281a47e0af9a.sql =====
-- Create a security definer function to check if a list_id is a valid shared list
CREATE OR REPLACE FUNCTION public.is_valid_shared_list(_list_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_lists WHERE id = _list_id
  );
$$;

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can view shared items" ON public.shared_grocery_items;
DROP POLICY IF EXISTS "Anyone can add items" ON public.shared_grocery_items;
DROP POLICY IF EXISTS "Anyone can update items" ON public.shared_grocery_items;
DROP POLICY IF EXISTS "Anyone can delete items" ON public.shared_grocery_items;

-- Create scoped policies: only allow operations on items belonging to a valid shared list
CREATE POLICY "Access items of valid shared lists"
ON public.shared_grocery_items
FOR SELECT
USING (public.is_valid_shared_list(list_id));

CREATE POLICY "Add items to valid shared lists"
ON public.shared_grocery_items
FOR INSERT
WITH CHECK (public.is_valid_shared_list(list_id));

CREATE POLICY "Update items in valid shared lists"
ON public.shared_grocery_items
FOR UPDATE
USING (public.is_valid_shared_list(list_id));

CREATE POLICY "Delete items from valid shared lists"
ON public.shared_grocery_items
FOR DELETE
USING (public.is_valid_shared_list(list_id));

-- ===== 20260222172908_e494bc53-e7ae-4b03-a7ed-4299b9c14df9.sql =====
-- Fix grocery_items policies: change from RESTRICTIVE to PERMISSIVE
DROP POLICY "Owner full access" ON public.grocery_items;
DROP POLICY "Shared list access" ON public.grocery_items;

CREATE POLICY "Owner full access" ON public.grocery_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared list access" ON public.grocery_items
  FOR ALL USING (user_has_shared_list(user_id)) WITH CHECK (user_has_shared_list(user_id));

-- Fix recipes policies: change from RESTRICTIVE to PERMISSIVE
DROP POLICY "Owner full access" ON public.recipes;
DROP POLICY "Shared list access" ON public.recipes;

CREATE POLICY "Owner full access" ON public.recipes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared list access" ON public.recipes
  FOR ALL USING (user_has_shared_list(user_id)) WITH CHECK (user_has_shared_list(user_id));

-- Fix usuals policies too
DROP POLICY "Owner full access" ON public.usuals;
DROP POLICY "Shared list access" ON public.usuals;

CREATE POLICY "Owner full access" ON public.usuals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared list access" ON public.usuals
  FOR ALL USING (user_has_shared_list(user_id)) WITH CHECK (user_has_shared_list(user_id));

-- ===== 20260310195615_a8834e44-e31b-4b8c-bc81-ffbe94d9a643.sql =====
-- Fix recipes policies: make PERMISSIVE instead of RESTRICTIVE
DROP POLICY IF EXISTS "Owner full access" ON public.recipes;
DROP POLICY IF EXISTS "Shared list access" ON public.recipes;

CREATE POLICY "Owner full access" ON public.recipes FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared list access" ON public.recipes FOR ALL TO public
  USING (user_has_shared_list(user_id))
  WITH CHECK (user_has_shared_list(user_id));

-- Fix grocery_items policies too
DROP POLICY IF EXISTS "Owner full access" ON public.grocery_items;
DROP POLICY IF EXISTS "Shared list access" ON public.grocery_items;

CREATE POLICY "Owner full access" ON public.grocery_items FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared list access" ON public.grocery_items FOR ALL TO public
  USING (user_has_shared_list(user_id))
  WITH CHECK (user_has_shared_list(user_id));

-- Fix usuals policies too
DROP POLICY IF EXISTS "Owner full access" ON public.usuals;
DROP POLICY IF EXISTS "Shared list access" ON public.usuals;

CREATE POLICY "Owner full access" ON public.usuals FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared list access" ON public.usuals FOR ALL TO public
  USING (user_has_shared_list(user_id))
  WITH CHECK (user_has_shared_list(user_id));

-- Fix shared_lists policies
DROP POLICY IF EXISTS "Owner can view own shared lists" ON public.shared_lists;
DROP POLICY IF EXISTS "Anyone can create shared lists" ON public.shared_lists;

CREATE POLICY "Owner can view own shared lists" ON public.shared_lists FOR SELECT TO public
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can create shared lists" ON public.shared_lists FOR INSERT TO public
  WITH CHECK (true);

-- ===== 20260310201828_e5d7fc4e-2b87-4801-ae9c-3d0ede7e093a.sql =====
CREATE TABLE public.purchase_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_name text NOT NULL,
  purchase_count integer NOT NULL DEFAULT 1,
  last_purchased_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, item_name)
);

ALTER TABLE public.purchase_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access" ON public.purchase_history FOR ALL TO public
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared list access" ON public.purchase_history FOR ALL TO public
  USING (user_has_shared_list(user_id))
  WITH CHECK (user_has_shared_list(user_id));

-- ===== 20260311183339_998fe14d-ff3f-475b-8a42-99593ad3d0c6.sql =====
ALTER TABLE public.grocery_items ADD COLUMN price numeric NULL;

-- ===== 20260311190944_e6d4707c-2c1d-41fa-bf7a-d3451b07900b.sql =====
CREATE TABLE public.meal_plans (
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

ALTER TABLE public.meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner full access" ON public.meal_plans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared list access" ON public.meal_plans FOR ALL
  USING (user_has_shared_list(user_id))
  WITH CHECK (user_has_shared_list(user_id));

ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_plans;

-- ===== migratiegeschiedenis =====
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
  ('20260311190944', 'e6d4707c-2c1d-41fa-bf7a-d3451b07900b')
ON CONFLICT (version) DO NOTHING;

COMMIT;
