-- ==============================================================================
-- MIGRAZIONE V1 FASE 1: LOG AUDIT GENERAZIONI & COMPLIANCE GDPR
-- ==============================================================================

-- 1. Tabella di Audit Tracciabile per le Generazioni AI
CREATE TABLE IF NOT EXISTS generation_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  child_profile_id UUID REFERENCES child_profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('STARTED', 'SUCCESS', 'MODERATION_BLOCKED', 'ERROR', 'CREDIT_REFUNDED')),
  prompt_summary TEXT,
  error_reason TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_audit_family_id ON generation_audit_logs(family_id);
CREATE INDEX IF NOT EXISTS idx_audit_started_at ON generation_audit_logs(started_at DESC);

-- Abilitazione RLS
ALTER TABLE generation_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: i genitori possono visualizzare ed inserire i log della propria famiglia
CREATE POLICY "I genitori accedono ai log della propria famiglia"
  ON generation_audit_logs
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

-- Aggiunta commenti di documentazione
COMMENT ON TABLE generation_audit_logs IS 'Traccia in modo inoppugnabile avvio ed esito di ogni generazione AI (storia, data/ora e status per verifiche crediti e moderazione).';
