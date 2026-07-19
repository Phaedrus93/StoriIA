-- MIGRAZIONE: AGGIUNTA COLONNA GENDER SU CHILD_PROFILES
ALTER TABLE public.child_profiles
  ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'neutral' CHECK (gender IN ('neutral', 'boy', 'girl'));

CREATE INDEX IF NOT EXISTS idx_child_profiles_gender ON public.child_profiles(gender);
