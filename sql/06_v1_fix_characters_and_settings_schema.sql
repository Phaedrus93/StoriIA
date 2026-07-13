-- 1. Aggiunta colonne mancanti in public.characters
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '/avatars/fox.svg';
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS is_preset BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.characters ALTER COLUMN owner_child_profile_id DROP NOT NULL;

-- 2. Aggiunta colonne mancanti in public.settings
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '/settings/forest.svg';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS is_preset BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.settings ALTER COLUMN owner_child_profile_id DROP NOT NULL;

COMMENT ON COLUMN public.characters.image_url IS 'URL o path del preset avatar selezionato per il personaggio.';
COMMENT ON COLUMN public.characters.is_preset IS 'Indica se il personaggio è un preset predefinito del sistema.';
COMMENT ON COLUMN public.settings.image_url IS 'URL o path del preset immagine selezionato per lambientazione.';
COMMENT ON COLUMN public.settings.is_preset IS 'Indica se lambientazione è un preset predefinito del sistema.';
