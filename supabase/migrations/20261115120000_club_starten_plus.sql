-- Een Cart Club starten (een uitnodiging maken) kan alleen met Plus. Meedoen
-- met iemands club blijft gratis. Bestaande clubs blijven gewoon werken, ook
-- als de oprichter geen Plus (meer) heeft: dit geldt alleen voor nieuwe.
--
-- De oude policy liet iedereen een rij maken, zelfs op andermans naam.

DROP POLICY IF EXISTS "Anyone can create shared lists" ON public.shared_lists;
DROP POLICY IF EXISTS "Plus start een Cart Club" ON public.shared_lists;
CREATE POLICY "Plus start een Cart Club" ON public.shared_lists
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_plus(auth.uid()));
