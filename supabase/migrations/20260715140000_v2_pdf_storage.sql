-- Migrazione v2 Phase 1: Storage PDF e Signed URL
-- 1. Aggiunta colonna pdf_storage_path su public.stories per caching
ALTER TABLE public.stories
ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT DEFAULT NULL;

-- 2. Creazione del bucket privato su storage.buckets
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id TEXT,
  name TEXT,
  owner UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('story-pdfs', 'story-pdfs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 3. Abilitazione e configurazione RLS per storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can upload to story-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Service role can select from story-pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete from story-pdfs" ON storage.objects;

-- Concedi accesso ESCLUSIVAMENTE al ruolo service_role per le operazioni su story-pdfs
CREATE POLICY "Service role can upload to story-pdfs"
ON storage.objects
FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'story-pdfs');

CREATE POLICY "Service role can select from story-pdfs"
ON storage.objects
FOR SELECT
TO service_role
USING (bucket_id = 'story-pdfs');

CREATE POLICY "Service role can delete from story-pdfs"
ON storage.objects
FOR DELETE
TO service_role
USING (bucket_id = 'story-pdfs');

-- IMPORTANTE: NESSUNA policy è definita per il ruolo `authenticated` o `anon` sul bucket story-pdfs.
-- Qualsiasi tentativo di accesso diretto (select, insert, delete, createSignedUrl) da parte di client con ruolo authenticated
-- fallirà con errore RLS, garantendo che i file siano accessibili solo tramite signed URL generate dal server/endpoint autorizzato.
