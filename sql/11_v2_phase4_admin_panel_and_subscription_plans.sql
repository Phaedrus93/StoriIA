-- ==============================================================================
-- MIGRAZIONE V2 FASE 4: PANNELLO ADMIN & MIGRAZIONE PARAMETRI PIANI
-- ==============================================================================

-- 1. Tabella SUBSCRIPTION_PLANS (Fonte di verità dinamica per i piani di abbonamento)
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  tier TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  max_children INTEGER NOT NULL,
  monthly_credits INTEGER NOT NULL,
  welcome_credits INTEGER NOT NULL,
  addon_max_per_family INTEGER NOT NULL DEFAULT 5,
  all_morals BOOLEAN NOT NULL DEFAULT false,
  price_monthly_cents INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.subscription_plans IS 'Configurazione e limiti dinamici per tier di abbonamento (sostituisce PLAN_LIMITS hardcoded).';

-- Seed iniziale dai valori di config.ts (PLAN_LIMITS) per garantire zero regressioni
INSERT INTO public.subscription_plans (tier, name, max_children, monthly_credits, welcome_credits, addon_max_per_family, all_morals, price_monthly_cents, description)
VALUES
  ('free', 'Gratuito', 1, 0, 5, 5, false, 0, 'Piano base gratuito con 1 profilo bambino e 5 crediti di benvenuto.'),
  ('premium', 'Premium', 3, 30, 0, 5, true, 999, 'Piano Premium con fino a 3 bambini, 30 crediti AI al mese e morali sbloccate.'),
  ('family', 'Famiglia', 6, 80, 0, 5, true, 1999, 'Piano Famiglia completo con fino a 6 bambini e 80 crediti AI al mese.')
ON CONFLICT (tier) DO UPDATE SET
  name = EXCLUDED.name,
  max_children = EXCLUDED.max_children,
  monthly_credits = EXCLUDED.monthly_credits,
  welcome_credits = EXCLUDED.welcome_credits,
  addon_max_per_family = EXCLUDED.addon_max_per_family,
  all_morals = EXCLUDED.all_morals,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  description = EXCLUDED.description,
  updated_at = now();

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutti possono leggere i piani abbonamento"
  ON public.subscription_plans FOR SELECT USING (true);

-- Nota: le scritture vengono effettuate lato server tramite service_role (createAdminClient), quindi le policy coprono solo SELECT.


-- 2. Tabella APP_CONFIG_PARAMETERS (Parametri di configurazione applicativa e modelli AI)
CREATE TABLE IF NOT EXISTS public.app_config_parameters (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_config_parameters IS 'Parametri di configurazione applicativa centralizzati (limiti 24h, sicurezza bambino, modelli Gemini).';

INSERT INTO public.app_config_parameters (key, value, description)
VALUES
  ('generation_max_per_family_24h', '20'::jsonb, 'Limite massimo di storie generate per famiglia nelle 24 ore'),
  ('child_mode_max_failed_pin', '5'::jsonb, 'Tentativi massimi PIN prima del blocco di sicurezza'),
  ('child_mode_lockout_minutes', '15'::jsonb, 'Minuti di blocco temporaneo dopo 5 tentativi errati'),
  ('ai_default_model', '"gemini-2.5-flash"'::jsonb, 'Modello Gemini principale per la generazione'),
  ('ai_fallback_model', '"gemini-2.0-flash"'::jsonb, 'Modello Gemini di riserva')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.app_config_parameters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutti possono leggere la configurazione app"
  ON public.app_config_parameters FOR SELECT USING (true);


-- 3. Tabella FIXED_TEXTS (Gestione centralizzata copy / testi fissi)
CREATE TABLE IF NOT EXISTS public.fixed_texts (
  key TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.fixed_texts IS 'Testi e stringhe di copy applicativo modificabili dal pannello admin.';

INSERT INTO public.fixed_texts (key, content, description)
VALUES
  ('welcome_banner_title', 'Benvenuti nel mondo magico di StoriIA!', 'Titolo banner di benvenuto in dashboard'),
  ('welcome_banner_subtitle', 'Scegli un profilo bambino e inizia a leggere o creare una nuova avventura indimenticabile.', 'Sottotitolo banner di benvenuto'),
  ('child_mode_warning', 'Sei in Modalità Bambino: le impostazioni e i pagamenti sono protetti da PIN.', 'Avviso sicurezza in modalità bambino')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.fixed_texts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutti possono leggere i testi fissi"
  ON public.fixed_texts FOR SELECT USING (true);


-- 4. Grant sui permessi per il ruolo anon/authenticated per le nuove tabelle accessibili in lettura
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT SELECT ON public.app_config_parameters TO anon, authenticated;
GRANT SELECT ON public.fixed_texts TO anon, authenticated;
