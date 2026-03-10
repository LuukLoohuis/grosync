
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
