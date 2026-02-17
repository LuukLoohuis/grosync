
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
