-- ==============================================================================
-- MIGRAZIONE V1 FASE 3: GAMIFICATION (PUNTI AVVENTURA, MISSIONI & NEGOZIO PREMI)
-- ==============================================================================

-- 1. Aggiunta colonna Punti Avventura a child_profiles
ALTER TABLE child_profiles
  ADD COLUMN IF NOT EXISTS adventure_points INTEGER NOT NULL DEFAULT 0
    CHECK (adventure_points >= 0);

-- 2. Tabella Missioni di Lettura (Reading Quests)
CREATE TABLE IF NOT EXISTS reading_quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 1,
  points_reward INTEGER NOT NULL DEFAULT 15,
  quest_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Progresso Missione per Profilo Bambino
CREATE TABLE IF NOT EXISTS child_quest_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  quest_id UUID NOT NULL REFERENCES reading_quests(id) ON DELETE CASCADE,
  current_progress INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  UNIQUE(child_profile_id, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_quest_progress_child ON child_quest_progress(child_profile_id);

-- 4. Catalogo Oggetti Cosmetici / Premi Sbloccabili
CREATE TABLE IF NOT EXISTS cosmetic_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('BADGE', 'AVATAR_FRAME')),
  cost_points INTEGER NOT NULL CHECK (cost_points >= 0),
  icon_preset TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Oggetti Cosmetici Sbloccati dal Bambino
CREATE TABLE IF NOT EXISTS child_unlocked_cosmetics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  cosmetic_id UUID NOT NULL REFERENCES cosmetic_items(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(child_profile_id, cosmetic_id)
);

CREATE INDEX IF NOT EXISTS idx_unlocked_cosmetics_child ON child_unlocked_cosmetics(child_profile_id);

-- 6. Policy RLS
ALTER TABLE reading_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_quest_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE cosmetic_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_unlocked_cosmetics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutti possono visualizzare le missioni attive"
  ON reading_quests FOR SELECT USING (true);

CREATE POLICY "Tutti possono visualizzare il catalogo cosmetico"
  ON cosmetic_items FOR SELECT USING (true);

CREATE POLICY "I genitori visualizzano e gestiscono i progressi missione dei figli"
  ON child_quest_progress
  FOR ALL
  USING (
    child_profile_id IN (
      SELECT id FROM child_profiles WHERE family_id IN (
        SELECT id FROM families WHERE parent_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "I genitori visualizzano e gestiscono i cosmetici sbloccati dai figli"
  ON child_unlocked_cosmetics
  FOR ALL
  USING (
    child_profile_id IN (
      SELECT id FROM child_profiles WHERE family_id IN (
        SELECT id FROM families WHERE parent_user_id = auth.uid()
      )
    )
  );

-- 7. Seed dati iniziali catalogo missioni e cosmetici
INSERT INTO reading_quests (title, description, target_count, points_reward, quest_type)
VALUES
  ('Prima Lettura Magica', 'Completa la lettura della tua prima storia su StoriIA', 1, 15, 'READING_COUNT'),
  ('Esploratore delle Favole', 'Completa la lettura di 3 storie diverse', 3, 30, 'READING_COUNT'),
  ('Maestro delle Avventure', 'Completa la lettura di 5 storie fantastiche', 5, 50, 'READING_COUNT')
ON CONFLICT DO NOTHING;

INSERT INTO cosmetic_items (name, category, cost_points, icon_preset)
VALUES
  ('Distintivo Apprendista Stregone', 'BADGE', 15, 'sparkles'),
  ('Medaglia Esploratore Spaziale', 'BADGE', 30, 'rocket'),
  ('Corona del Regno Fatato', 'BADGE', 50, 'crown'),
  ('Cornice Stella D''Oro', 'AVATAR_FRAME', 40, 'star_frame')
ON CONFLICT DO NOTHING;

COMMENT ON COLUMN child_profiles.adventure_points IS 'Punti Avventura guadagnati dal bambino leggendo storie (denominazione provvisoria "Punti Avventura").';
