-- ==============================================================================
-- StoriIA — Migration Fix Bug v1 (Schema Aggiornato & Funzioni Atomiche RPC)
-- ==============================================================================

-- 1. Tabella di log ed esito moderazione contenuti (con family_id per RLS semplificata)
CREATE TABLE IF NOT EXISTS moderation_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  setting_id UUID REFERENCES settings(id) ON DELETE SET NULL,
  stage TEXT NOT NULL CHECK (stage IN ('input', 'output')),
  result TEXT NOT NULL CHECK (result IN ('passed', 'blocked', 'retried')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mod_flags_family_id ON moderation_flags(family_id);
CREATE INDEX IF NOT EXISTS idx_mod_flags_created_at ON moderation_flags(created_at DESC);

ALTER TABLE moderation_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Genitori leggono i flag della propria famiglia"
  ON moderation_flags FOR SELECT
  USING (
    family_id IN (
      SELECT id FROM families WHERE parent_user_id = auth.uid()
    )
  );

-- 2. Colonna di sospensione per profili bambino eccedenti (downgrade piano)
ALTER TABLE child_profiles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;

-- 3. Colonne ID Stripe su families per tracciamento customer e subscription (e cancellazione GDPR)
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_families_stripe_customer ON families(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_families_stripe_sub ON families(stripe_subscription_id);

-- 4. Funzione atomica per consumo del credito e registrazione su credit_ledger
CREATE OR REPLACE FUNCTION consume_credit(
  p_family_id UUID,
  p_description TEXT DEFAULT 'Generazione storia AI',
  p_reference_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE families
  SET credits_balance = credits_balance - 1
  WHERE id = p_family_id AND credits_balance > 0;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    INSERT INTO credit_ledger (family_id, amount, transaction_type, description, reference_id)
    VALUES (p_family_id, -1, 'GENERATION_SPEND', p_description, p_reference_id);
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- 5. Funzione atomica per rimborso automatico del credito e registrazione su credit_ledger
CREATE OR REPLACE FUNCTION refund_credit(
  p_family_id UUID,
  p_description TEXT DEFAULT 'Rimborso automatico generazione fallita',
  p_reference_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE families
  SET credits_balance = credits_balance + 1
  WHERE id = p_family_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated > 0 THEN
    INSERT INTO credit_ledger (family_id, amount, transaction_type, description, reference_id)
    VALUES (p_family_id, 1, 'GENERATION_REFUND', p_description, p_reference_id);
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;
