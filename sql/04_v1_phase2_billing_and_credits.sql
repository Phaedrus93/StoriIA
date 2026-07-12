-- ==============================================================================
-- MIGRAZIONE V1 FASE 2: PROFILO FATTURAZIONE GENITORE, CREDITI & STRIPE LEDGER
-- ==============================================================================

-- 1. Tabella Profilo Fatturazione Genitore (Anagrafica Fiscale per acquisti)
CREATE TABLE IF NOT EXISTS parent_billing_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL UNIQUE REFERENCES families(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  tax_id TEXT, -- Codice Fiscale o P.IVA per l'Italia
  billing_address TEXT,
  city TEXT,
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'IT',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_family_id ON parent_billing_profiles(family_id);

ALTER TABLE parent_billing_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "I genitori gestiscono il proprio profilo di fatturazione"
  ON parent_billing_profiles
  FOR ALL
  USING (
    family_id IN (
      SELECT id FROM families WHERE parent_user_id = auth.uid()
    )
  )
  WITH CHECK (
    family_id IN (
      SELECT id FROM families WHERE parent_user_id = auth.uid()
    )
  );

-- 2. Estensione della tabella families per il portafoglio crediti e stato abbonamento
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'premium', 'family')),
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'frozen', 'canceled')),
  ADD COLUMN IF NOT EXISTS credits_balance INTEGER NOT NULL DEFAULT 5
    CHECK (credits_balance >= 0);

-- 3. Tabella Contabile Ledger Crediti (Tracciabilità in Partita Doppia)
CREATE TABLE IF NOT EXISTS credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positivo (accredito/rimborso) o Negativo (addebito)
  transaction_type TEXT NOT NULL CHECK (
    transaction_type IN (
      'WELCOME_BONUS',
      'GENERATION_SPEND',
      'GENERATION_REFUND',
      'SUBSCRIPTION_RENEWAL',
      'CREDIT_PACK_PURCHASE'
    )
  ),
  description TEXT NOT NULL,
  reference_id UUID, -- id di generation_audit_logs, story_id o stripe_payment_id
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_family_id ON credit_ledger(family_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created_at ON credit_ledger(created_at DESC);

ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "I genitori visualizzano lo storico crediti della propria famiglia"
  ON credit_ledger
  FOR SELECT
  USING (
    family_id IN (
      SELECT id FROM families WHERE parent_user_id = auth.uid()
    )
  );

COMMENT ON TABLE parent_billing_profiles IS 'Dati anagrafici e fiscali del genitore per fatturazione Stripe e compliance legale.';
COMMENT ON TABLE credit_ledger IS 'Registro immutabile delle transazioni di crediti per audit e trasparenza verso la famiglia.';
