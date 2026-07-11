# Skill: storiia-data-model

## Quando usarla
Ogni volta che si crea o modifica una tabella Supabase, una migration, o
si progetta una query che coinvolge families, child_profiles,
characters, settings, stories, story_assignments.

## Convenzioni obbligatorie

- Ogni tabella con dati di famiglia deve avere `family_id` denormalizzato
  quando semplifica query trasversali (es. characters, settings), anche
  se esiste già un percorso di join più lungo passando per
  child_profiles
- Naming: snake_case per tabelle e colonne, plurale per nomi tabella
  (`stories`, non `story`)
- Ogni tabella ha `created_at`; le tabelle mutabili hanno anche
  `updated_at`
- Le entità "libreria" (characters, settings) sono di proprietà di un
  child_profile specifico (`owner_child_profile_id`) ma leggibili da
  tutta la famiglia in fase di generazione storia — MAI filtrare le
  query di lettura solo su `owner_child_profile_id`, sempre anche su
  `family_id`
- Le storie (stories) non sono mai legate in modo esclusivo a un
  bambino: l'assegnazione e il progresso di lettura vivono SEMPRE in
  `story_assignments`, mai come campo dentro `stories`
- Prima di ogni migration che elimina o modifica una colonna esistente,
  proponi il piano di migrazione dati, non eseguirlo direttamente

## RLS — regola non negoziabile

Ogni policy deve essere scritta assumendo che un utente in "modalità
bambino" possa provare a chiamare qualunque endpoint direttamente
(bypassando la UI). Le policy vanno testate esplicitamente per questo
scenario, non solo per il flusso UI normale.
