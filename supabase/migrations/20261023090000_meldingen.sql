-- Pushmeldingen: een seintje als iemand anders uit je Cart Club iets doet.
-- Per toestel een abonnement (de browser geeft endpoint en sleutels), per
-- persoon welke soorten aan staan, en een logboek zodat niemand meer dan één
-- melding per soort per tien minuten krijgt.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Het adres van de pushdienst van de browser; uniek per toestel en browser.
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Eigen toestellen" ON public.push_subscriptions;
CREATE POLICY "Eigen toestellen" ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Zonder rij staat alles aan, met stille uren van 22:00 tot 8:00.
CREATE TABLE IF NOT EXISTS public.push_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  toegevoegd BOOLEAN NOT NULL DEFAULT true,
  winkel BOOLEAN NOT NULL DEFAULT true,
  klaar BOOLEAN NOT NULL DEFAULT true,
  voorraad BOOLEAN NOT NULL DEFAULT true,
  club BOOLEAN NOT NULL DEFAULT true,
  stille_uren BOOLEAN NOT NULL DEFAULT true,
  tijdzone TEXT NOT NULL DEFAULT 'Europe/Amsterdam',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Eigen instellingen" ON public.push_settings;
CREATE POLICY "Eigen instellingen" ON public.push_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Alleen de functie push-send (service role) leest en schrijft hierin.
CREATE TABLE IF NOT EXISTS public.push_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  soort TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_log_recent_idx ON public.push_log (recipient, soort, created_at DESC);

ALTER TABLE public.push_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_log FROM anon, authenticated;

-- Een toestel aanmelden voor wie nu is ingelogd. Logde er eerder iemand anders
-- in op dezelfde browser, dan geeft die browser hetzelfde endpoint: dat
-- toestel gaat dan over naar de nieuwe gebruiker (de oude rij is via RLS
-- onzichtbaar, dus de app kan hem zelf niet weghalen).
CREATE OR REPLACE FUNCTION public.meld_toestel_aan(_endpoint TEXT, _p256dh TEXT, _auth TEXT, _user_agent TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Inloggen is vereist';
  END IF;
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  VALUES (auth.uid(), _endpoint, _p256dh, _auth, left(_user_agent, 300))
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent, created_at = now();
END;
$$;
REVOKE EXECUTE ON FUNCTION public.meld_toestel_aan(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meld_toestel_aan(TEXT, TEXT, TEXT, TEXT) TO authenticated;
