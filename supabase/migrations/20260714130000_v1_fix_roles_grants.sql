-- ==============================================================================
-- StoriIA v1.5 — Fix Privilegi PostgreSQL (GRANT) per Ruoli Supabase
-- Risolve gli errori "permission denied for table" e applica il principio
-- di minimo privilegio per il ruolo anon.
-- ==============================================================================

-- 1. Garanzia di accesso allo schema public per i tre ruoli base di Supabase
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Concessione di tutti i privilegi su tutte le tabelle, sequenze e routine
--    esistenti nello schema public per i ruoli authenticated e service_role.
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

-- 3. Revoca di qualsiasi permesso generale precedentemente concesso ad anon
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- 4. Concessione esplicita di SELECT per anon SOLO alle tabelle genuinamente pubbliche
GRANT SELECT ON public.avatar_presets TO anon;
GRANT SELECT ON public.moral_lessons TO anon;

-- 5. Grant espliciti (difesa in profondità) su tutte le tabelle create dopo init_schema
GRANT ALL ON public.notifications TO authenticated, service_role;
GRANT ALL ON public.notification_preferences TO authenticated, service_role;
GRANT ALL ON public.parent_billing_profiles TO authenticated, service_role;
GRANT ALL ON public.cosmetic_items TO authenticated, service_role;
GRANT ALL ON public.reading_quests TO authenticated, service_role;
GRANT ALL ON public.child_quest_progress TO authenticated, service_role;
GRANT ALL ON public.child_unlocked_cosmetics TO authenticated, service_role;
GRANT ALL ON public.narrative_content_catalog TO authenticated, service_role;
GRANT ALL ON public.family_unlocked_content TO authenticated, service_role;
GRANT ALL ON public.stripe_webhook_events TO authenticated, service_role;
GRANT ALL ON public.credit_ledger TO authenticated, service_role;
GRANT ALL ON public.story_assignments TO authenticated, service_role;

-- 6. Default privileges per il futuro: su ogni nuova tabella creata in schema public
--    verranno automaticamente concessi i privilegi ad authenticated e service_role.
--    Nota: come difesa in profondità, ogni futura migration aggiungerà comunque
--    esplicitamente GRANT ALL ON <tabella> TO authenticated, service_role.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated, service_role;
