-- ============================================================
-- CoupleCart - Volledige database migratie
-- Kopieer en plak dit in je Supabase SQL Editor (supabase.com)
-- Dashboard > SQL Editor > New Query > Plak > Run
-- ============================================================

-- 1. Shared lists tabel
CREATE TABLE public.shared_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_code TEXT NOT NULL UNIQUE DEFAULT substr(gen_random_uuid()::text, 1, 8),
  name TEXT NOT NULL DEFAULT 'Grocery List',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create shared lists" ON public.shared_lists
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Owner can view own shared lists" ON public.shared_lists
  FOR SELECT USING (auth.uid() = user_id);

-- 2. Shared grocery items tabel
CREATE TABLE public.shared_grocery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.shared_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  from_recipe TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_grocery_items ENABLE ROW LEVEL SECURITY;

-- 3. Grocery items tabel (per user)
CREATE TABLE public.grocery_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  from_recipe TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.grocery_items ENABLE ROW LEVEL SECURITY;

-- 4. Recipes tabel (per user)
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  ingredients TEXT[] NOT NULL DEFAULT '{}',
  instructions TEXT,
  image_url TEXT,
  source_url TEXT,
  macros JSONB DEFAULT NULL,
  servings INTEGER DEFAULT 4,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- 5. Usuals tabel (vaste boodschappen)
CREATE TABLE public.usuals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.usuals ENABLE ROW LEVEL SECURITY;

-- 6. Helper functies (SECURITY DEFINER)
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

-- 7. RLS Policies - grocery_items
CREATE POLICY "Owner full access" ON public.grocery_items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared list access" ON public.grocery_items
  FOR ALL USING (user_has_shared_list(user_id)) WITH CHECK (user_has_shared_list(user_id));

-- 8. RLS Policies - recipes
CREATE POLICY "Owner full access" ON public.recipes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared list access" ON public.recipes
  FOR ALL USING (user_has_shared_list(user_id)) WITH CHECK (user_has_shared_list(user_id));

-- 9. RLS Policies - usuals
CREATE POLICY "Owner full access" ON public.usuals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Shared list access" ON public.usuals
  FOR ALL USING (user_has_shared_list(user_id)) WITH CHECK (user_has_shared_list(user_id));

-- 10. RLS Policies - shared_grocery_items
CREATE POLICY "Access items of valid shared lists" ON public.shared_grocery_items
  FOR SELECT USING (public.is_valid_shared_list(list_id));

CREATE POLICY "Add items to valid shared lists" ON public.shared_grocery_items
  FOR INSERT WITH CHECK (public.is_valid_shared_list(list_id));

CREATE POLICY "Update items in valid shared lists" ON public.shared_grocery_items
  FOR UPDATE USING (public.is_valid_shared_list(list_id));

CREATE POLICY "Delete items from valid shared lists" ON public.shared_grocery_items
  FOR DELETE USING (public.is_valid_shared_list(list_id));

-- 11. Realtime inschakelen
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_grocery_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.grocery_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.recipes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.usuals;
