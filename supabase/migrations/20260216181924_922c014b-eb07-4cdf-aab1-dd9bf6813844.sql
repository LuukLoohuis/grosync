
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
