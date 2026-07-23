-- ==============================================================================
-- MIGRAZIONE V2 FASE 13.1: PROFILO GENITORE & COSMETICI PER GENITORI
-- ==============================================================================

-- 1. Arricchimento Tabella families con i dettagli del Profilo Genitore
ALTER TABLE public.families
  ADD COLUMN IF NOT EXISTS parent_display_name TEXT DEFAULT 'Genitore StoriIA',
  ADD COLUMN IF NOT EXISTS parent_role TEXT DEFAULT 'Genitore',
  ADD COLUMN IF NOT EXISTS parent_avatar_preset_id TEXT REFERENCES public.avatar_presets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_equipped_badge_id UUID REFERENCES public.cosmetic_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_equipped_frame_id UUID REFERENCES public.cosmetic_items(id) ON DELETE SET NULL;

-- 2. Inserimento di Preset Avatar specifici per i Genitori nel catalogo avatar_presets
INSERT INTO public.avatar_presets (id, name, image_url, gender, is_free, is_active, display_order)
VALUES
  ('parent-preset-owl', 'Gufo Custode', '/avatars/parent-owl.png', 'neutral', true, true, 100),
  ('parent-preset-king', 'Re Saggio', '/avatars/parent-king.png', 'boy', true, true, 101),
  ('parent-preset-queen', 'Regina della Luce', '/avatars/parent-queen.png', 'girl', true, true, 102),
  ('parent-preset-wizard', 'Mago delle Favole', '/avatars/parent-wizard.png', 'neutral', true, true, 103),
  ('parent-preset-keeper', 'Custode della Biblioteca', '/avatars/parent-keeper.png', 'neutral', true, true, 104)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  image_url = EXCLUDED.image_url,
  gender = EXCLUDED.gender,
  is_free = EXCLUDED.is_free,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order;

-- 3. Inserimento di Oggetti Cosmetici (Badge & Cornici) per i Genitori nel catalogo cosmetic_items
INSERT INTO public.cosmetic_items (name, category, cost_points, icon_preset)
VALUES
  ('Custode della Fiaba', 'BADGE', 20, 'sparkles'),
  ('Narratore Reale', 'BADGE', 40, 'crown'),
  ('Maestro della Biblioteca', 'BADGE', 50, 'book'),
  ('Genitore Regale D''Oro', 'AVATAR_FRAME', 50, 'star_frame'),
  ('Cornice Notte Stellata', 'AVATAR_FRAME', 30, 'night_frame')
ON CONFLICT DO NOTHING;

COMMENT ON COLUMN public.families.parent_display_name IS 'Nome visualizzato del genitore (es. Mamma Laura, Papà Marco).';
COMMENT ON COLUMN public.families.parent_role IS 'Ruolo o titolo guida della famiglia (es. Mamma, Papà, Nonno/a).';
COMMENT ON COLUMN public.families.parent_avatar_preset_id IS 'ID del preset avatar scelto per il genitore.';
