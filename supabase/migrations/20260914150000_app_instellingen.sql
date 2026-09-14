-- Instellingen die je zonder nieuwe versie wilt kunnen omzetten, zoals welk
-- taalmodel de app gebruikt. Alleen de beheerder ziet en zet ze; de edge
-- functions lezen ze met de service role.

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Beheerder leest instellingen" ON public.app_settings;
CREATE POLICY "Beheerder leest instellingen" ON public.app_settings
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Beheerder zet instellingen" ON public.app_settings;
CREATE POLICY "Beheerder zet instellingen" ON public.app_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Leeg betekent: gebruik wat er in de omgeving staat (OpenAI, tenzij anders gezet).
INSERT INTO public.app_settings (key, value)
VALUES ('ai', '{"provider": "", "text_model": "", "scan_model": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;
