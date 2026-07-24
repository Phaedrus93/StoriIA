-- Batch 6: Parent Avatar & Gift Code Duration

-- 1. Aggiunta campo duration_months ai gift_codes per gestire abbonamenti custom
ALTER TABLE public.gift_codes
ADD COLUMN IF NOT EXISTS duration_months INTEGER;

-- 2. Aggiunta campo target_audience per gli avatar preset (child, parent, both)
ALTER TABLE public.avatar_presets
ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT 'child' CHECK (target_audience IN ('child', 'parent', 'both'));

-- 3. Creazione del bucket Supabase per gli avatar (pubblico)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;
END $$;

-- 4. Policy RLS per il bucket avatars
CREATE POLICY "Gli avatar sono pubblici" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Solo gli amministratori (o auth) possono fare upload su avatars" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Gli utenti autenticati possono modificare oggetti avatars" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Gli utenti autenticati possono eliminare oggetti avatars" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
