-- Abonnementen via Stripe. De betaling zelf gebeurt bij Stripe; wij bewaren
-- alleen wie er Plus heeft, tot wanneer, en onder welk klantnummer.

ALTER TABLE public.plus_members ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.plus_members ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE public.plus_members ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.plus_members ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS plus_members_klant_idx ON public.plus_members (stripe_customer_id);

-- Stripe stuurt een gebeurtenis soms twee keer; verwerkte gebeurtenissen
-- onthouden we, zodat een herhaling niets dubbel doet.
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Niemand leest dit vanuit de app; alleen de webhook schrijft, met de service role.
DROP POLICY IF EXISTS "Beheerder leest gebeurtenissen" ON public.stripe_events;
CREATE POLICY "Beheerder leest gebeurtenissen" ON public.stripe_events
  FOR SELECT USING (public.is_admin());
