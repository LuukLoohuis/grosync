-- Meldingen voor de beheerder: nu alleen "iemand heeft Plus gekocht".
-- Een trigger op plus_members schrijft ze, zodat elke weg naar een betaald
-- abonnement (webhook, later misschien iets anders) vanzelf meetelt.

CREATE TABLE IF NOT EXISTS public.admin_meldingen (
  id BIGSERIAL PRIMARY KEY,
  soort TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  gemaakt_op TIMESTAMPTZ NOT NULL DEFAULT now(),
  gelezen_op TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS admin_meldingen_nieuw_idx
  ON public.admin_meldingen (gemaakt_op DESC);

ALTER TABLE public.admin_meldingen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Beheer leest meldingen" ON public.admin_meldingen;
CREATE POLICY "Beheer leest meldingen" ON public.admin_meldingen
  FOR SELECT USING (public.is_admin());

-- Schrijven gaat alleen via de trigger en de functie hieronder.
REVOKE INSERT, UPDATE, DELETE ON public.admin_meldingen FROM anon, authenticated;

-- Een nieuw Stripe-abonnement = een aankoop. Verlengingen houden hetzelfde
-- abonnement-id en tellen dus niet; opnieuw afsluiten na opzeggen wel.
CREATE OR REPLACE FUNCTION public.meld_plus_gekocht()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.source = 'stripe'
     AND NEW.stripe_subscription_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.stripe_subscription_id IS DISTINCT FROM NEW.stripe_subscription_id)
  THEN
    INSERT INTO public.admin_meldingen (soort, user_id, email)
    SELECT 'plus_gekocht', NEW.user_id, u.email
    FROM auth.users u WHERE u.id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS plus_gekocht_melding ON public.plus_members;
CREATE TRIGGER plus_gekocht_melding
  AFTER INSERT OR UPDATE OF stripe_subscription_id, source ON public.plus_members
  FOR EACH ROW EXECUTE FUNCTION public.meld_plus_gekocht();

REVOKE ALL ON FUNCTION public.meld_plus_gekocht() FROM PUBLIC, anon, authenticated;

-- Alles tot nu toe als gelezen markeren.
CREATE OR REPLACE FUNCTION public.admin_meldingen_gelezen()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  aantal INTEGER;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Geen toegang'; END IF;
  UPDATE public.admin_meldingen SET gelezen_op = now() WHERE gelezen_op IS NULL;
  GET DIAGNOSTICS aantal = ROW_COUNT;
  RETURN aantal;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_meldingen_gelezen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_meldingen_gelezen() TO authenticated;
