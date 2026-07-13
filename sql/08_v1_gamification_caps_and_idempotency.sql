-- Aggiunta colonna points_awarded sulla tabella story_assignments per evitare addebiti/accrediti multipli di punti sulla stessa storia per lo stesso bambino
ALTER TABLE public.story_assignments ADD COLUMN IF NOT EXISTS points_awarded BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.story_assignments.points_awarded IS 'Indica se i Punti Avventura (+15) sono già stati conferiti per il completamento di questa specifica assegnazione.';
