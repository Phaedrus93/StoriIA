# StoriIA v2 — Roadmap operativa per Antigravity CLI

Regola generale valida per ogni fase: chiedi sempre il piano prima del
codice, chiedi sempre la verifica dopo il codice ("mostrami cosa hai
testato, non solo cosa hai scritto"), non passare alla fase successiva
finché non hai testato tu manualmente la precedente.

---

## FASE 0 — Setup e contesto

**Prompt 1 (contesto iniziale, incolla tutto `01_PRD.md` prima di questo):**
```
Ti ho appena dato il PRD completo di StoriIA in tre blocchi (MVP/v1/v2).
Per ora lavoriamo SOLO sul blocco MVP. Non implementare nulla dei blocchi
v1/v2 anche se lo vedi menzionato nel PRD come contesto futuro.
Confermami che hai capito lo scope MVP esatto prima di procedere.
```

**Prompt 2 (piano architetturale):**
```
Ecco anche lo schema dati completo [incolla 02_data_model.md, sezione
MVP]. Proponimi:
1. Lo schema Supabase con le tabelle MVP e le RLS policy, in particolare
   come enforcare il blocco "modalità bambino" lato backend
2. La struttura cartelle Next.js (App Router)
3. Dove e come integrare la chiamata a Google AI Studio (Gemini API) per
   la generazione storia, inclusa gestione della API key come variabile
   d'ambiente
4. I rischi tecnici che vedi in questo scope
Non scrivere codice finché non approvo questo piano.
```

---

## FASE 1 — Auth e struttura famiglia

```
Implementa auth Supabase (solo genitore, email/password). Crea le
tabelle families e child_profiles con RLS: un genitore vede solo la
propria famiglia. Aggiungi CRUD completo per child_profiles (crea,
modifica, elimina, assegna avatar da preset). Scrivi un test che
verifichi che un genitore non possa leggere child_profiles di un'altra
famiglia.
```

---

## FASE 2 — Character e Setting builder

```
Implementa characters e settings secondo lo schema: proprietà di un
child_profile specifico, ma selezionabili da tutta la famiglia in fase
di generazione storia. Query di lettura devono filtrare per family_id,
non solo per child_profile_id. CRUD completo (crea/modifica/elimina),
con conferma esplicita prima di eliminare un personaggio già usato in
storie esistenti.
```

---

## FASE 3 — Generazione storia

```
Implementa l'endpoint di generazione storia: input = character_id,
setting_id, target_age_range, moral_lesson_id (nullable), chiamata a
Google AI Studio (Gemini API) per produrre il testo in italiano,
calibrato per l'età target. Salva in stories. Aggiungi rate limit soft
(20 generazioni/giorno per famiglia) solo come rete di sicurezza contro
loop o bug, non come limite di business. Gestisci esplicitamente il
caso di errore della chiamata AI con messaggio d'errore chiaro
all'utente.
```

---

## FASE 4 — Libreria e assegnazione storie

```
Implementa story_assignments: una storia generata va assegnata a uno o
più child_profile della famiglia. Nella UI genitore, mostra la libreria
storie con possibilità di assegnare/rimuovere l'assegnazione a ciascun
figlio. Implementa il tracking di last_read_position e reading_status
per coppia storia-bambino, con salvataggio debounced (ogni 5-10 secondi
o all'uscita dalla schermata di lettura, non ad ogni scroll).
```

---

## FASE 5 — Modalità bambino

```
Implementa una modalità di sessione "bambino": sola lettura delle storie
assegnate al profilo attivo, sezioni "nuove"/"in corso"/"lette" basate su
reading_status, funzione "continua a leggere" per le storie in_progress.
Verifica con un test esplicito che, in modalità bambino, le chiamate API
di creazione personaggio/ambientazione/storia e le route di
gestione account vengano rifiutate lato backend (RLS o middleware),
anche bypassando la UI e chiamando l'endpoint direttamente.
```

---

## FASE 6 — Config centralizzato e log di base

```
Centralizza tutta la configurazione applicativa (limiti, chiavi di
feature flag, URL, parametri di generazione) in un unico file di config
[vedi 05_config.example.ts come riferimento di struttura]. Aggiungi
logging di base per la chiamata AI e per gli errori, senza esporre
API key nei log. Il livello di verbosità del log deve essere
controllato da una variabile in questo file di config.
```

---

## Checkpoint prima di considerare l'MVP "finito"

Prima di iniziare a usarlo con tua figlia, verifica manualmente:
- [ ] Riesci a creare un profilo bambino, un personaggio, un'ambientazione
- [ ] La generazione storia funziona e il testo è adatto all'età scelta
- [ ] Puoi assegnare la stessa storia a più figli (se ne hai più di uno)
- [ ] "Continua a leggere" riprende davvero dal punto giusto
- [ ] In modalità bambino non è possibile creare/eliminare nulla, nemmeno
      forzando l'URL o l'endpoint direttamente
- [ ] Hai riletto tu stesso ogni storia generata prima che la legga tua
      figlia (non c'è ancora moderazione automatica in MVP)

---

## FASE 7+ — Solo dopo test MVP positivo: avvio v1

Quando l'MVP ti convince, apri una nuova sessione di pianificazione:
```
L'MVP di StoriIA funziona ed è stato validato. Ora vogliamo aggiungere
il blocco v1 dal PRD: sistema crediti, tier abbonamento con Stripe,
moderazione contenuti, pagine legali, cancellazione account,
gamification punti/badge, notifiche base. Proponimi l'ordine di
implementazione più sicuro, partendo da moderazione contenuti e
struttura legale PRIMA di aprire il prodotto a chiunque non sia della
tua famiglia.
```
Non chiamare questo prompt finché non hai davvero testato l'MVP con
uso reale — non solo scritto il codice.
