-- "Stop met delen": de eigenaar mag zijn deellijst verwijderen. De leden in
-- shared_list_members verdwijnen dan mee (ON DELETE CASCADE), zodat niemand
-- nog bij de lijst kan. Een nieuwe deellink krijgt een nieuwe code.
DROP POLICY IF EXISTS "Eigenaar verwijdert deellijst" ON public.shared_lists;
CREATE POLICY "Eigenaar verwijdert deellijst" ON public.shared_lists
  FOR DELETE USING (user_id = auth.uid());
