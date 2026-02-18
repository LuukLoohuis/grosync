
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
