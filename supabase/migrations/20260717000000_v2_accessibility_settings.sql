-- ==============================================================================
-- StoriIA v2 Fase 3 — Colonne Accessibilità e Funzione SECURITY DEFINER
-- ==============================================================================

-- 1. Aggiunta colonne accessibilità su child_profiles
ALTER TABLE public.child_profiles
ADD COLUMN IF NOT EXISTS night_mode BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS brightness INTEGER NOT NULL DEFAULT 100 CHECK (brightness >= 50 AND brightness <= 150),
ADD COLUMN IF NOT EXISTS contrast INTEGER NOT NULL DEFAULT 100 CHECK (contrast >= 70 AND contrast <= 150),
ADD COLUMN IF NOT EXISTS font_size TEXT NOT NULL DEFAULT 'medium' CHECK (font_size IN ('small', 'medium', 'large', 'xlarge'));

-- 2. Funzione SECURITY DEFINER per aggiornare ESCLUSIVAMENTE le preferenze di accessibilità
CREATE OR REPLACE FUNCTION public.update_reading_accessibility(
  p_child_profile_id UUID,
  p_night_mode BOOLEAN DEFAULT NULL,
  p_brightness INTEGER DEFAULT NULL,
  p_contrast INTEGER DEFAULT NULL,
  p_font_size TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_child_family_id UUID;
BEGIN
  -- 1. Verifica esistenza e famiglia del profilo target
  SELECT family_id INTO v_child_family_id
  FROM public.child_profiles
  WHERE id = p_child_profile_id;

  IF v_child_family_id IS NULL OR v_child_family_id IS DISTINCT FROM public.get_my_family_id() THEN
    RAISE EXCEPTION 'Accesso negato: il profilo bambino non esiste o non appartiene alla tua famiglia.';
  END IF;

  -- 2. Verifica permessi in base alla modalità corrente
  IF public.is_child_mode() THEN
    -- In modalità bambino, si può aggiornare SOLO il proprio profilo attivo (Isolamento Fratelli)
    IF p_child_profile_id IS DISTINCT FROM public.get_active_child_profile_id() THEN
      RAISE EXCEPTION 'Accesso negato in modalità bambino: impossibile modificare le preferenze di un altro profilo (isolamento fratelli).';
    END IF;
  END IF;

  -- 3. Aggiornamento ESCLUSIVO delle sole 4 colonne di accessibilità
  UPDATE public.child_profiles
  SET night_mode = COALESCE(p_night_mode, night_mode),
      brightness = COALESCE(p_brightness, brightness),
      contrast = COALESCE(p_contrast, contrast),
      font_size = COALESCE(p_font_size, font_size)
  WHERE id = p_child_profile_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_reading_accessibility(UUID, BOOLEAN, INTEGER, INTEGER, TEXT) TO authenticated, service_role;
