-- ==============================================================================
-- StoriIA — Migrazione Fase 7 (PRD v2): Segnalazione Contenuto Problematico
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  reported_by_family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  reason_category TEXT NOT NULL CHECK (
    reason_category IN (
      'inappropriate_theme',
      'bad_language',
      'moral_inconsistency',
      'technical_defect',
      'other'
    )
  ),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- Indici di ottimizzazione per le ricerche e per la dashboard admin
CREATE INDEX IF NOT EXISTS idx_content_reports_story_id ON public.content_reports(story_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_reported_by_family_id ON public.content_reports(reported_by_family_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON public.content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_created_at ON public.content_reports(created_at DESC);

-- Abilitazione della sicurezza a livello di riga (RLS)
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Policy di Lettura (SELECT):
-- I genitori autenticati possono leggere esclusivamente le segnalazioni inviate dalla propria famiglia.
-- L'amministratore accede all'elenco completo tramite createAdminClient() (service_role) che bypassa RLS.
DROP POLICY IF EXISTS "content_reports_parent_select_own" ON public.content_reports;
CREATE POLICY "content_reports_parent_select_own"
ON public.content_reports
FOR SELECT
TO authenticated
USING (
  reported_by_family_id IN (
    SELECT id FROM public.families WHERE parent_user_id = auth.uid()
  )
);

-- Policy di Inserimento (INSERT):
-- I genitori autenticati possono inserire nuove segnalazioni solo per la propria famiglia.
DROP POLICY IF EXISTS "content_reports_parent_insert_own" ON public.content_reports;
CREATE POLICY "content_reports_parent_insert_own"
ON public.content_reports
FOR INSERT
TO authenticated
WITH CHECK (
  reported_by_family_id IN (
    SELECT id FROM public.families WHERE parent_user_id = auth.uid()
  )
);
