-- Aggiunta colonna image_url alle tabelle characters e settings
ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '/avatars/fox.svg';
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '/settings/forest.svg';

COMMENT ON COLUMN public.characters.image_url IS 'URL o path del preset avatar selezionato per il personaggio.';
COMMENT ON COLUMN public.settings.image_url IS 'URL o path del preset immagine selezionato per lambientazione.';
