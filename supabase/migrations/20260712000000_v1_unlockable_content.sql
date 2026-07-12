-- ==============================================================================
-- MIGRAZIONE V1: CONTENUTI SBLOCCABILI, ADDON BAMBINI, GAMIFICATION ESTESA
-- Dipende da: 20260711000000_init_schema, 20260711120000_v1_phase3_gamification
-- ==============================================================================

-- 1. Slot bambini aggiuntivi acquistati (add-on Stripe)
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS addon_children_count INTEGER NOT NULL DEFAULT 0
    CHECK (addon_children_count >= 0);

-- 2. Piano richiesto per sblocco cosmetici (free / premium / family)
ALTER TABLE cosmetic_items
  ADD COLUMN IF NOT EXISTS requires_plan TEXT NOT NULL DEFAULT 'free'
    CHECK (requires_plan IN ('free', 'premium', 'family'));

-- 3. Badge e cornice attivi sul profilo bambino
ALTER TABLE child_profiles
  ADD COLUMN IF NOT EXISTS active_badge_id UUID REFERENCES cosmetic_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_frame_id UUID REFERENCES cosmetic_items(id) ON DELETE SET NULL;

-- 4. Catalogo contenuti narrativi acquistabili (tratti personaggio, temi ambientazione, stili storia)
CREATE TABLE IF NOT EXISTS narrative_content_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('CHARACTER_TRAIT', 'SETTING_THEME', 'STORY_STYLE')),
  description TEXT NOT NULL,
  stripe_price_id TEXT,
  pack_id TEXT,
  price_cents INTEGER NOT NULL DEFAULT 199,
  requires_plan TEXT NOT NULL DEFAULT 'free' CHECK (requires_plan IN ('free', 'premium', 'family')),
  icon_preset TEXT NOT NULL DEFAULT 'star',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Contenuti narrativi sbloccati dalla famiglia
CREATE TABLE IF NOT EXISTS family_unlocked_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES narrative_content_catalog(id) ON DELETE CASCADE,
  unlocked_via TEXT NOT NULL DEFAULT 'purchase' CHECK (unlocked_via IN ('purchase', 'subscription', 'bonus')),
  stripe_session_id TEXT,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(family_id, content_id)
);

CREATE INDEX IF NOT EXISTS idx_unlocked_content_family ON family_unlocked_content(family_id);

-- 6. RLS
ALTER TABLE narrative_content_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_unlocked_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tutti leggono il catalogo narrativo"
  ON narrative_content_catalog FOR SELECT USING (true);

CREATE POLICY "Famiglie gestiscono i propri contenuti sbloccati"
  ON family_unlocked_content FOR ALL
  USING (
    family_id IN (SELECT id FROM families WHERE parent_user_id = auth.uid())
  )
  WITH CHECK (
    family_id IN (SELECT id FROM families WHERE parent_user_id = auth.uid())
  );

-- 7. Aggiornamento cosmetici esistenti: assegna requires_plan
UPDATE cosmetic_items SET requires_plan = 'premium'
WHERE name IN ('Corona del Regno Fatato', 'Cornice Stella D''Oro');

UPDATE cosmetic_items SET requires_plan = 'family'
WHERE name IN ('Medaglia Esploratore Spaziale');

-- 8. Seed catalogo contenuti narrativi
INSERT INTO narrative_content_catalog (name, content_type, description, price_cents, pack_id, icon_preset) VALUES
  -- Tratti Personaggio
  ('Mago del Ghiaccio',    'CHARACTER_TRAIT', 'Poteri magici sul gelo e cristalli di neve. Crea tempeste e ponti di ghiaccio.', 199, 'pack-inverno',  'snowflake'),
  ('Drago Parlante',       'CHARACTER_TRAIT', 'Un magnifico drago saggio che comunica per volare e risolvere enigmi antichi.', 199, 'pack-fantasy',  'flame'),
  ('Robot Empatico',       'CHARACTER_TRAIT', 'Un robot del futuro che ha sviluppato emozioni e aiuta chi è in difficoltà.', 199, 'pack-spazio',   'cpu'),
  ('Sirena Esploratrice',  'CHARACTER_TRAIT', 'Coraggiosa custode del mare, conosce ogni corrente e creatura degli abissi.', 199, 'pack-mare',     'waves'),
  -- Ambientazioni Tematiche
  ('Galassia dei Pianeti Nascosti', 'SETTING_THEME', 'Sistema stellare con pianeti segreti abitati da creature di pura luce cosmica.',        199, 'pack-spazio',   'star'),
  ('Foresta dei Funghi Giganti',    'SETTING_THEME', 'Foresta magica dove i funghi giganti colorati custodiscono storie antichissime.',        199, 'pack-fantasy',  'trees'),
  ('Castello di Ghiaccio Eterno',   'SETTING_THEME', 'Maestoso palazzo di cristallo ghiacciato con stanze segrete e specchi magici.',          199, 'pack-inverno',  'snowflake'),
  ('Città Sottomarina degli Abissi','SETTING_THEME', 'Metropoli luminosa sul fondo dell''oceano costruita da creature marine intelligenti.',   199, 'pack-mare',     'anchor'),
  -- Stili Storia
  ('Avventura Epica',      'STORY_STYLE', 'Narrazione con eroi leggendari, sfide grandiose, battaglie di coraggio e vittorie memorabili.', 299, NULL, 'shield'),
  ('Mistero da Risolvere', 'STORY_STYLE', 'Storia con indizi nascosti, enigmi da scoprire e un finale sorprendente e inaspettato.',        299, NULL, 'search')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE narrative_content_catalog IS 'Catalogo contenuti narrativi acquistabili (tratti personaggio, ambientazioni, stili) che arricchiscono il wizard di creazione storie.';
COMMENT ON TABLE family_unlocked_content IS 'Registro dei contenuti narrativi sbloccati dalla famiglia via acquisto Stripe o abbonamento.';
