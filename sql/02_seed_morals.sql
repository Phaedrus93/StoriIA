-- Seed delle lezioni morali predefinite per StoriIA MVP
INSERT INTO public.moral_lessons (id, title, description, is_free)
VALUES
  (gen_random_uuid(), 'Condivisione e generosità', 'È bello dividere i giochi e le merende con gli amici e i fratelli.', true),
  (gen_random_uuid(), 'Il coraggio di provare cose nuove', 'Superare la paura dell''ignoto affrontando una piccola sfida con fiducia.', true),
  (gen_random_uuid(), 'Il valore dell''ascolto e della pazienza', 'Rispettare il proprio turno e ascoltare le parole degli altri con attenzione.', true),
  (gen_random_uuid(), 'Rispetto per la natura e gli animali', 'Prendersi cura dei piccoli esseri viventi e proteggere l''ambiente.', true),
  (gen_random_uuid(), 'L''importanza della sincerità', 'Dire sempre la verità, perché l''onestà rende le amicizie più forti.', true)
ON CONFLICT DO NOTHING;
