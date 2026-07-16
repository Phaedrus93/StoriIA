-- 1. Aggiunta della colonna cost_points al catalogo dei contenuti narrativi
ALTER TABLE public.narrative_content_catalog
  ADD COLUMN IF NOT EXISTS cost_points INTEGER NOT NULL DEFAULT 40 CHECK (cost_points >= 0);

UPDATE public.narrative_content_catalog SET cost_points = 30 WHERE content_type = 'CHARACTER_TRAIT';
UPDATE public.narrative_content_catalog SET cost_points = 40 WHERE content_type = 'SETTING_THEME';
UPDATE public.narrative_content_catalog SET cost_points = 50 WHERE content_type = 'STORY_STYLE';

-- 2. Creazione della tabella child_unlocked_content per il possesso dei contenuti narrativi a livello di singolo profilo bambino
CREATE TABLE IF NOT EXISTS public.child_unlocked_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES public.narrative_content_catalog(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(child_profile_id, content_id)
);

CREATE INDEX IF NOT EXISTS idx_child_unlocked_content_child ON public.child_unlocked_content(child_profile_id);
CREATE INDEX IF NOT EXISTS idx_child_unlocked_content_item ON public.child_unlocked_content(content_id);

ALTER TABLE public.child_unlocked_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "I genitori gestiscono i contenuti sbloccati dai propri figli"
  ON public.child_unlocked_content
  FOR ALL
  USING (
    child_profile_id IN (
      SELECT id FROM public.child_profiles WHERE family_id IN (
        SELECT id FROM public.families WHERE parent_user_id = auth.uid()
      )
    )
  );

-- 3. Migrazione dei record esistenti da family_unlocked_content a tutti i profili bambino della famiglia
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'family_unlocked_content') THEN
    INSERT INTO public.child_unlocked_content (child_profile_id, content_id, unlocked_at)
    SELECT cp.id, fuc.content_id, fuc.unlocked_at
    FROM public.family_unlocked_content fuc
    JOIN public.child_profiles cp ON cp.family_id = fuc.family_id
    ON CONFLICT (child_profile_id, content_id) DO NOTHING;
    
    DROP TABLE public.family_unlocked_content CASCADE;
  END IF;
END $$;
