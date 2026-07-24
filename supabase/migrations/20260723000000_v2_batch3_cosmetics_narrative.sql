-- ==============================================================================
-- MIGRAZIONE V2 FASE BATCH 3: MIGLIORIE CATALOGHI GAMIFICATION E CONTENUTI
-- ==============================================================================

-- 1. Aggiunta colonne a cosmetic_items per gestire meglio i tipi
ALTER TABLE public.cosmetic_items
  ADD COLUMN IF NOT EXISTS unlock_requirement TEXT,
  ADD COLUMN IF NOT EXISTS frame_color TEXT,
  ADD COLUMN IF NOT EXISTS frame_effect TEXT;

COMMENT ON COLUMN public.cosmetic_items.unlock_requirement IS 'Testo descrittivo del requisito missione (es. Completa 5 letture).';
COMMENT ON COLUMN public.cosmetic_items.frame_color IS 'Codice HEX del colore della cornice (es. #ff0000).';
COMMENT ON COLUMN public.cosmetic_items.frame_effect IS 'Effetto speciale della cornice (es. solid, glow, sparkle).';

-- 2. Creazione del bucket Supabase per le icone Gamification (pubblico)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('gamification', 'gamification', true)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- 3. Policy RLS per il bucket gamification
-- Lettura pubblica
CREATE POLICY "Le icone gamification sono pubbliche" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'gamification');

-- Inserimento consentito agli amministratori (o utenti autenticati in questo contesto)
CREATE POLICY "Solo gli utenti autenticati possono fare upload su gamification" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'gamification' AND auth.role() = 'authenticated'
);

-- Aggiornamento e cancellazione (stessa logica)
CREATE POLICY "Gli utenti autenticati possono modificare oggetti gamification" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'gamification' AND auth.role() = 'authenticated');

CREATE POLICY "Gli utenti autenticati possono eliminare oggetti gamification" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'gamification' AND auth.role() = 'authenticated');
