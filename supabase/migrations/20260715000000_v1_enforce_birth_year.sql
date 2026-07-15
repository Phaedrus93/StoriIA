-- ==============================================================================
-- StoriIA v1.6 — Enforce Birth Year Mandatory & Check
-- ==============================================================================

-- 1. Se per qualche motivo esistono profili senza anno di nascita (dati legacy), impostare un valore di fallback
UPDATE public.child_profiles
SET birth_year = 2018
WHERE birth_year IS NULL;

-- 2. Rendere birth_year obbligatorio (NOT NULL)
ALTER TABLE public.child_profiles
  ALTER COLUMN birth_year SET NOT NULL;

-- 3. Aggiungere un vincolo di check sull'anno di nascita per evitare valori assurdi o errati
ALTER TABLE public.child_profiles
  DROP CONSTRAINT IF EXISTS check_birth_year_valid;
ALTER TABLE public.child_profiles
  ADD CONSTRAINT check_birth_year_valid CHECK (birth_year >= 2000 AND birth_year <= 2100);
