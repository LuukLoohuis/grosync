-- Recepten in de Cart Club: iedereen in de club mag de recepten van de andere
-- leden lezen. Tot nu toe zag een lid alleen die van de eigenaar (de app draait
-- op diens rijen), en bleef wat een lid vóór het instappen had onzichtbaar,
-- ook voor de eigenaar. Schrijven blijft zoals het was: je eigen rijen en, als
-- lid, die van de eigenaar.

-- Zit _user in dezelfde club als jij? De club is die van je eigenaar als je
-- ergens lid bent, anders je eigen; dezelfde keuze als cart_club_leden.
CREATE OR REPLACE FUNCTION public.in_zelfde_club(_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH club AS (
    SELECT COALESCE(
      (SELECT m.owner_id FROM public.shared_list_members m
        WHERE m.member_id = auth.uid() AND m.owner_id <> auth.uid()
        ORDER BY m.created_at LIMIT 1),
      auth.uid()
    ) AS owner_id
  )
  SELECT auth.uid() IS NOT NULL AND _user IS NOT NULL AND (
    _user = (SELECT owner_id FROM club)
    OR EXISTS (
      SELECT 1 FROM public.shared_list_members m, club
       WHERE m.owner_id = club.owner_id AND m.member_id = _user
    )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.in_zelfde_club(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.in_zelfde_club(UUID) TO authenticated;

DROP POLICY IF EXISTS "Club leest recepten" ON public.recipes;
CREATE POLICY "Club leest recepten" ON public.recipes FOR SELECT TO authenticated
  USING (public.in_zelfde_club(user_id));
