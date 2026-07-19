-- MIGRAZIONE: AGGIUNTA COLONNE GENDER, IS_ACTIVE E DEFAULT SU ID PER AVATAR_PRESETS
ALTER TABLE public.avatar_presets 
  ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'neutral' CHECK (gender IN ('neutral', 'boy', 'girl'));

ALTER TABLE public.avatar_presets 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.avatar_presets 
  ALTER COLUMN id SET DEFAULT ('avatar-' || gen_random_uuid()::text);

CREATE INDEX IF NOT EXISTS idx_avatar_presets_gender ON public.avatar_presets(gender);
