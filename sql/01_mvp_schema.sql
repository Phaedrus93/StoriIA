-- ==============================================================================
-- StoriIA MVP (Blocco 1) — Schema Dati Completo & Policy di Sicurezza (RLS)
-- ==============================================================================

-- 0. Funzione generica per aggiornare automaticamente updated_at
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Tabella FAMILIES (dati generali famiglia, senza alcun dato sensibile o hash di sicurezza)
CREATE TABLE IF NOT EXISTS public.families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1bis. Tabella FAMILY_SECURITY (isolata dalle query client, senza policy SELECT per authenticated)
CREATE TABLE IF NOT EXISTS public.family_security (
  family_id UUID PRIMARY KEY REFERENCES public.families(id) ON DELETE CASCADE,
  parent_pin_hash TEXT,
  pin_failed_attempts INTEGER NOT NULL DEFAULT 0,
  pin_locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger per inizializzare automaticamente il record in family_security alla creazione della famiglia
CREATE OR REPLACE FUNCTION public.init_family_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.family_security (family_id, parent_pin_hash, pin_failed_attempts, pin_locked_until)
  VALUES (NEW.id, NULL, 0, NULL)
  ON CONFLICT (family_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_family_created
AFTER INSERT ON public.families
FOR EACH ROW
EXECUTE FUNCTION public.init_family_security();

-- 2. Tabella AVATAR_PRESETS
CREATE TABLE IF NOT EXISTS public.avatar_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  is_free BOOLEAN NOT NULL DEFAULT true
);

-- 3. Tabella CHILD_PROFILES
CREATE TABLE IF NOT EXISTS public.child_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  birth_year INTEGER,
  avatar_preset_id TEXT REFERENCES public.avatar_presets(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_child_profiles_updated_at
BEFORE UPDATE ON public.child_profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- 4. Tabella CHARACTERS (Character Builder)
CREATE TABLE IF NOT EXISTS public.characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_child_profile_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  traits TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Tabella SETTINGS (Setting Builder - Ambientazioni)
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_child_profile_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Tabella MORAL_LESSONS
CREATE TABLE IF NOT EXISTS public.moral_lessons (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  is_free BOOLEAN NOT NULL DEFAULT true
);

-- 7. Tabella STORIES
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE,
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  setting_id UUID REFERENCES public.settings(id) ON DELETE SET NULL,
  moral_lesson_id TEXT REFERENCES public.moral_lessons(id) ON DELETE SET NULL,
  target_age_range TEXT NOT NULL CHECK (target_age_range IN ('0-3', '4-6', '7-10')),
  generated_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ai_generated' CHECK (source IN ('ai_generated', 'preset')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Tabella STORY_ASSIGNMENTS
CREATE TABLE IF NOT EXISTS public.story_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  child_profile_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  reading_status TEXT NOT NULL DEFAULT 'new' CHECK (reading_status IN ('new', 'in_progress', 'completed')),
  last_read_position INTEGER NOT NULL DEFAULT 0 CHECK (last_read_position >= 0 AND last_read_position <= 100),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(story_id, child_profile_id)
);

CREATE TRIGGER set_story_assignments_updated_at
BEFORE UPDATE ON public.story_assignments
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ==============================================================================
-- HELPER FUNZIONI SQL PER SICUREZZA E MODALITA' BAMBINO
-- ==============================================================================

-- Funzione per verificare se la sessione corrente è in "Modalità Bambino"
CREATE OR REPLACE FUNCTION public.is_child_mode()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_child_mode')::boolean, false);
$$;

-- Funzione per leggere l'ID del profilo bambino attivo dal JWT
CREATE OR REPLACE FUNCTION public.get_active_child_profile_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'active_child_profile_id', '')::uuid;
$$;

-- Funzione per ottenere la propria famiglia associata al parent_user_id
CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.families WHERE parent_user_id = auth.uid() LIMIT 1;
$$;

-- Funzione SECURITY DEFINER per impostare o aggiornare l'hash del PIN sulla tabella family_security
CREATE OR REPLACE FUNCTION public.set_parent_pin_hash(p_family_id UUID, p_pin_hash TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica che la famiglia appartenga all'utente chiamante e che non sia in modalità bambino
  IF p_family_id IS DISTINCT FROM public.get_my_family_id() THEN
    RAISE EXCEPTION 'Accesso negato: impossibile impostare il PIN per una famiglia non propria.';
  ELSIF public.is_child_mode() THEN
    RAISE EXCEPTION 'Accesso negato: impossibile impostare il PIN in modalità bambino.';
  END IF;

  INSERT INTO public.family_security (family_id, parent_pin_hash, pin_failed_attempts, pin_locked_until)
  VALUES (p_family_id, p_pin_hash, 0, NULL)
  ON CONFLICT (family_id)
  DO UPDATE SET
    parent_pin_hash = EXCLUDED.parent_pin_hash,
    pin_failed_attempts = 0,
    pin_locked_until = NULL,
    updated_at = now();
END;
$$;

-- Funzione SECURITY DEFINER per registrare tentativi di sblocco PIN in modo controllato
CREATE OR REPLACE FUNCTION public.record_pin_attempt(p_family_id UUID, p_success BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica che la famiglia appartenga all'utente chiamante (anche se in modalità bambino)
  IF p_family_id IS DISTINCT FROM public.get_my_family_id() THEN
    RAISE EXCEPTION 'Accesso negato: impossibile registrare tentativi PIN per una famiglia non propria.';
  END IF;

  INSERT INTO public.family_security (family_id)
  VALUES (p_family_id)
  ON CONFLICT (family_id) DO NOTHING;

  IF p_success THEN
    UPDATE public.family_security
    SET pin_failed_attempts = 0,
        pin_locked_until = NULL,
        updated_at = now()
    WHERE family_id = p_family_id;
  ELSE
    UPDATE public.family_security
    SET pin_failed_attempts = pin_failed_attempts + 1,
        pin_locked_until = CASE
          WHEN pin_failed_attempts + 1 >= 5 THEN now() + interval '15 minutes'
          ELSE pin_locked_until
        END,
        updated_at = now()
    WHERE family_id = p_family_id;
  END IF;
END;
$$;

-- Funzione SECURITY DEFINER per consultare lo stato di blocco (lockout) e l'hash per la sola propria famiglia
CREATE OR REPLACE FUNCTION public.get_lockout_status(p_family_id UUID)
RETURNS TABLE (
  is_locked BOOLEAN,
  failed_attempts INTEGER,
  locked_until TIMESTAMPTZ,
  pin_hash TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_family_id IS DISTINCT FROM public.get_my_family_id() THEN
    RAISE EXCEPTION 'Accesso negato: impossibile consultare lo stato di sicurezza per una famiglia non propria.';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(fs.pin_locked_until > now(), false) AS is_locked,
    fs.pin_failed_attempts,
    fs.pin_locked_until,
    fs.parent_pin_hash
  FROM public.family_security fs
  WHERE fs.family_id = p_family_id;
END;
$$;


-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_security ENABLE ROW LEVEL SECURITY;
-- NESSUNA policy SELECT/INSERT/UPDATE/DELETE su family_security per ruoli authenticated/anon!
-- In questo modo, nessuna query client potrà mai leggere o estrarre l'hash del PIN o lo stato di blocco.
ALTER TABLE public.avatar_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.child_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moral_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_assignments ENABLE ROW LEVEL SECURITY;

-- FAMILIES
CREATE POLICY "Le famiglie possono leggere il proprio record"
  ON public.families FOR SELECT
  USING (parent_user_id = auth.uid());

CREATE POLICY "I genitori possono aggiornare il proprio record famiglia (non in modalità bambino)"
  ON public.families FOR UPDATE
  USING (parent_user_id = auth.uid() AND NOT public.is_child_mode());

CREATE POLICY "I nuovi utenti possono creare la propria famiglia"
  ON public.families FOR INSERT
  WITH CHECK (parent_user_id = auth.uid() AND NOT public.is_child_mode());

-- AVATAR_PRESETS (pubblicamente leggibili da tutti gli utenti autenticati)
CREATE POLICY "Tutti possono leggere i preset avatar"
  ON public.avatar_presets FOR SELECT
  TO authenticated
  USING (true);

-- MORAL_LESSONS (pubblicamente leggibili da tutti gli utenti autenticati)
CREATE POLICY "Tutti possono leggere le morali predefinite"
  ON public.moral_lessons FOR SELECT
  TO authenticated
  USING (true);

-- CHILD_PROFILES
CREATE POLICY "Lettura profili bambino della famiglia"
  ON public.child_profiles FOR SELECT
  USING (family_id = public.get_my_family_id());

CREATE POLICY "Modifica/Creazione/Eliminazione profili bambino solo se NOT in modalità bambino"
  ON public.child_profiles FOR ALL
  USING (family_id = public.get_my_family_id() AND NOT public.is_child_mode())
  WITH CHECK (family_id = public.get_my_family_id() AND NOT public.is_child_mode());

-- CHARACTERS
CREATE POLICY "Lettura personaggi della famiglia"
  ON public.characters FOR SELECT
  USING (family_id = public.get_my_family_id());

CREATE POLICY "Scrittura personaggi consentita solo se NOT in modalità bambino"
  ON public.characters FOR ALL
  USING (family_id = public.get_my_family_id() AND NOT public.is_child_mode())
  WITH CHECK (family_id = public.get_my_family_id() AND NOT public.is_child_mode());

-- SETTINGS (Ambientazioni)
CREATE POLICY "Lettura ambientazioni della famiglia"
  ON public.settings FOR SELECT
  USING (family_id = public.get_my_family_id());

CREATE POLICY "Scrittura ambientazioni consentita solo se NOT in modalità bambino"
  ON public.settings FOR ALL
  USING (family_id = public.get_my_family_id() AND NOT public.is_child_mode())
  WITH CHECK (family_id = public.get_my_family_id() AND NOT public.is_child_mode());

-- STORIES
CREATE POLICY "Lettura storie della famiglia"
  ON public.stories FOR SELECT
  USING (family_id = public.get_my_family_id() OR source = 'preset');

CREATE POLICY "Scrittura/Eliminazione storie solo se NOT in modalità bambino"
  ON public.stories FOR ALL
  USING (family_id = public.get_my_family_id() AND NOT public.is_child_mode())
  WITH CHECK (family_id = public.get_my_family_id() AND NOT public.is_child_mode());

-- STORY_ASSIGNMENTS
CREATE POLICY "Lettura assegnazioni storie della famiglia"
  ON public.story_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles c
      WHERE c.id = story_assignments.child_profile_id
        AND c.family_id = public.get_my_family_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_assignments.story_id
        AND (s.family_id = public.get_my_family_id() OR s.source = 'preset')
    )
    AND (
      NOT public.is_child_mode()
      OR story_assignments.child_profile_id = public.get_active_child_profile_id()
    )
  );

CREATE POLICY "Creazione/Eliminazione assegnazioni solo se NOT in modalità bambino"
  ON public.story_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_profiles c
      WHERE c.id = story_assignments.child_profile_id
        AND c.family_id = public.get_my_family_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_assignments.story_id
        AND (s.family_id = public.get_my_family_id() OR s.source = 'preset')
    )
    AND NOT public.is_child_mode()
  );

CREATE POLICY "Eliminazione assegnazioni solo se NOT in modalità bambino"
  ON public.story_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles c
      WHERE c.id = story_assignments.child_profile_id
        AND c.family_id = public.get_my_family_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_assignments.story_id
        AND (s.family_id = public.get_my_family_id() OR s.source = 'preset')
    )
    AND NOT public.is_child_mode()
  );

CREATE POLICY "Aggiornamento progresso di lettura consentito alla famiglia o al bambino proprietario"
  ON public.story_assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.child_profiles c
      WHERE c.id = story_assignments.child_profile_id
        AND c.family_id = public.get_my_family_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_assignments.story_id
        AND (s.family_id = public.get_my_family_id() OR s.source = 'preset')
    )
    AND (
      NOT public.is_child_mode()
      OR story_assignments.child_profile_id = public.get_active_child_profile_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.child_profiles c
      WHERE c.id = story_assignments.child_profile_id
        AND c.family_id = public.get_my_family_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.stories s
      WHERE s.id = story_assignments.story_id
        AND (s.family_id = public.get_my_family_id() OR s.source = 'preset')
    )
    AND (
      NOT public.is_child_mode()
      OR story_assignments.child_profile_id = public.get_active_child_profile_id()
    )
  );

-- ==============================================================================
-- SEED DATA — AVATAR PRESETS GRATUITI & MORALI PREDEFINITE
-- ==============================================================================

INSERT INTO public.avatar_presets (id, name, image_url, is_free) VALUES
('avatar-exploratrice', 'Esploratrice Stellare', '/avatars/explorer.svg', true),
('avatar-cavaliere', 'Piccolo Cavaliere', '/avatars/knight.svg', true),
('avatar-volpe', 'Volpe Saggia', '/avatars/fox.svg', true),
('avatar-drago', 'Draghetto Curioso', '/avatars/dragon.svg', true),
('avatar-inventore', 'Giovane Inventore', '/avatars/inventor.svg', true),
('avatar-astronauta', 'Astronauta Coraggioso', '/avatars/astronaut.svg', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  image_url = EXCLUDED.image_url,
  is_free = EXCLUDED.is_free;

INSERT INTO public.moral_lessons (id, label, is_free) VALUES
('moral-condividere', 'L''importanza di condividere con gli altri', true),
('moral-coraggio', 'Affrontare le piccole paure con coraggio', true),
('moral-amicizia', 'Il valore prezioso dell''amicizia e del rispetto', true),
('moral-curiosita', 'La curiosità e la voglia di imparare cose nuove', true),
('moral-gentilezza', 'Essere gentili ed aiutare chi si trova in difficoltà', true),
('moral-onesta', 'L''importanza della sincerità', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.stories (id, family_id, target_age_range, generated_text, source) VALUES
('11111111-1111-1111-1111-111111111101', NULL, '0-3', '# Il Volpino e la Stella Lucente

C''era una volta un piccolo volpino di nome Lino che amava guardare il cielo notturno. Ogni sera prima della nanna si affacciava alla finestra della sua tana dorata.

Una sera vide una stellina che brillava forte forte e sembrava fargli l''occhiolino. "Din-don", cantava il vento tra le foglie degli alberi.

Lino sorrise felice, chiuse gli occhietti e si addormentò sognando di volare tra le nuvole soffici come cotone.', 'preset'),
('11111111-1111-1111-1111-111111111102', NULL, '0-3', '# L''Orsetto e il Barattolo di Miele

Nel bosco verde viveva un tenero orsetto di nome Barnaba. A Barnaba piaceva tantissimo fare passeggiate mattutine tra i fiorellini di bosco.

Un giorno trovò un barattolo di miele dolcissimo e decise di dividerlo con il suo amico scoiattolo. Insieme fecero una allegra merenda sull''erba fresca.

Felici e con il pancino pieno, si salutarono con un grande abbraccio affettuoso prima del pisolino pomeridiano.', 'preset'),
('11111111-1111-1111-1111-111111111103', NULL, '4-6', '# La Chiave Magica del Giardino Segreto

Sofia era una bambina molto curiosa che amava esplorare il giardino dei nonni. Un pomeriggio soleggiato notò un luccichio sotto un cespuglio di rose profumate.

Era una piccola chiave d''oro con un nastro azzurro legato al manico. Con tanta emozione cercò la porta giusta e scoprì un giardino incantato dove le farfalle cantavano dolci melodie.

Capì che la natura nasconde meraviglie speciali per chi sa osservare con pazienza e gentilezza verso ogni creatura.', 'preset'),
('11111111-1111-1111-1111-111111111104', NULL, '4-6', '# Il Piccolo Drago che Non Sapeva Volare

In cima alla Montagna Blu abitava Zeffiro, un draghetto gentile che aveva paura dell''altezza e non riusciva a spiccare il volo come i suoi fratelli maggiori.

Un giorno una piccola rondine cadde dal nido su un ramo basso. Per salvarla e riportarla alla sua mamma, Zeffiro fece un grande respiro, aprì le sue ali color smeraldo e fece un salto coraggioso.

Scoprì così che il coraggio nasce quando pensiamo ad aiutare chi ha bisogno di noi.', 'preset'),
('11111111-1111-1111-1111-111111111105', NULL, '7-10', '# Il Mistero della Bussola d''Argento

Leo e la sua squadra di esploratori stavano studiando le antiche mappe della Valle Smeraldo quando trovarono una bussola d''argento che puntava sempre verso la Foresta di Nebbia.

Decisi a svelare il segreto, intrapresero un viaggio avventuroso attraverso sentieri dimenticati e ponti sospesi. Lungo il cammino dovettero risolvere enigmi antichi lavorando insieme come un vero gruppo affiatato.

Alla fine giunsero al Faro Antico, imparando che la vera forza non risiede nel successo individuale, ma nella lealtà e nella collaborazione tra veri amici.', 'preset'),
('11111111-1111-1111-1111-111111111106', NULL, '7-10', '# L''Invenzione dello Scienziato Timido

Nella città di Cronos il giovane inventore Nico lavorava segretamente al suo laboratorio di ingranaggi magici per depurare l''acqua del fiume cittadino.

Temendo il giudizio degli altri scienziati, aveva sempre tenuto nascoste le sue invenzioni. Ma quando una siccità improvvisa mise in pericolo i giardini pubblici, Nico decise di farsi avanti e mostrare il suo progetto al consiglio cittadino.

Con sorpresa e gioia di tutti, la macchina funzionò alla perfezione: Nico comprese che le buone idee vanno condivise con coraggio per il bene comune.', 'preset')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- PRIVILEGI E GRANT POSTGRESQL PER RUOLI SUPABASE
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

