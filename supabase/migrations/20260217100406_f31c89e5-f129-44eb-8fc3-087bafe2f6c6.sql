
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
