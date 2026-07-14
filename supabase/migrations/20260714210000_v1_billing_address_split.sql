-- ==============================================================================
-- StoriIA v1.5 — Indirizzo Fatturazione: CAP e Città separati
-- Verifica l'esistenza di postal_code e city in parent_billing_profiles
-- e migra eventuali dati se address conteneva tutto in un solo campo.
-- ==============================================================================

ALTER TABLE public.parent_billing_profiles
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT;

COMMENT ON COLUMN public.parent_billing_profiles.city IS 'Città di residenza/fatturazione per anagrafica fiscale';
COMMENT ON COLUMN public.parent_billing_profiles.postal_code IS 'Codice Avviamento Postale (CAP)';
