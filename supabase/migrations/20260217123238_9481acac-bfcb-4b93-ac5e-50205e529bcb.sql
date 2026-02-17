
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
