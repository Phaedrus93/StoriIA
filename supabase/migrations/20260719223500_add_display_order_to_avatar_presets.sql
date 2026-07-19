-- ==============================================================================
-- MIGRAZIONE: AGGIUNTA COLONNA DISPLAY_ORDER SU AVATAR_PRESETS
-- ==============================================================================

ALTER TABLE public.avatar_presets
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_avatar_presets_display_order ON public.avatar_presets(display_order);
