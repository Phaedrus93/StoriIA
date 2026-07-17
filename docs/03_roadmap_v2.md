# StoriIA — Roadmap prompt per il Blocco v2

Un prompt per fase, nell'ordine indicato nel PRD v2. Non passare alla
fase successiva finché l'hash del commit della fase corrente non è
stato confermato manualmente.

---

## Fase 1 — Export PDF

```
Implementa l'export PDF di una storia (Fase 1 del PRD v2). Solo testo:
titolo, testo integrale, fascia d'età, morale se presente, data. Nessun
dato del profilo bambino a cui è assegnata nel documento. Generazione
lato server, libreria PDF Node-native leggera (non un browser headless
per un documento di solo testo). Pulsante "Scarica PDF" in archivio
storie e vista dettaglio. Aggiungi un test che verifichi il contenuto
testuale del PDF generato e l'assenza di dati del profilo bambino.
Mostrami il piano prima di scrivere codice.
```

## Fase 2 — Età automatica dal profilo bambino

```
Implementa la Fase 2 del PRD v2: in /stories/new, la selezione di un
bambino specifico resta OPZIONALE. Se selezionato, calcola la fascia
d'età da birth_year rispetto alla data corrente, pre-compilando il
selettore età esistente — che resta comunque modificabile manualmente
prima di generare. Se nessun bambino è selezionato, il flusso attuale
di selezione manuale della fascia d'età resta invariato. Non introdurre
nessun vincolo che leghi la storia generata a un bambino specifico:
story_assignments resta il solo meccanismo di assegnazione. Aggiungi un
test che verifichi il calcolo corretto della fascia d'età per un
bambino nato in vari anni rispetto alla data corrente.
```

## Fase 3 — Area impostazioni unificata

```
Implementa la Fase 3 del PRD v2: un hub unico di impostazioni con
sezioni Account, Sicurezza Modalità Bambino (PIN), Fatturazione e
Abbonamento (integra o linka /billing/manage esistente), Notifiche,
Dati e Privacy (export/eliminazione account). Un solo punto di ingresso
in navigazione. Nessuna funzione di gestione account deve restare
raggiungibile solo da una pagina isolata non collegata a questo hub.
Mostrami il piano di navigazione/routing prima di spostare le pagine
esistenti.
```

## Fase 4 — Pannello admin

```
Implementa il pannello admin (Fase 4 del PRD v2): gestione preset
avatar, missioni/badge/cornici, testi fissi, morali predefinite, storie preset,
parametri di configurazione applicativa, parametri piani abbonamenti, limiti utilizzo. Accesso ristretto al solo
utente amministratore (per ora identificato per user id o email
specifico, non serve un sistema di ruoli complesso). NESSUNA API key
(Gemini, Stripe, service role Supabase) deve essere visibile o
gestibile da questa interfaccia in nessuna forma. Aggiungi un test che
verifichi che un utente non-admin riceva 403 su ogni route admin.
```

## Fase 5 — Log/debug con redazione

```
Implementa il sistema di log/debug (Fase 5 del PRD v2) secondo quanto
già previsto in config.ts (logging.level, redactedFields,
verboseLogRetentionDays). Redazione automatica dei campi sensibili in
ogni log, indipendentemente dal livello di verbosità. Aggiungi un test
che attivi il livello verboso e verifichi che nessun campo sensibile
compaia mai in chiaro nell'output.
```

## Fase 6 — Regalo crediti/abbonamento

```
Implementa il flusso regalo (Fase 6 del PRD v2) usando la skill
storiia-payments-security per ogni parte che tocca Stripe/crediti.
Tabella gift_codes. Nessuna concessione di crediti/tier senza conferma
webhook Stripe sull'acquisto iniziale del codice regalo.
```

## Fase 7 — Segnalazione contenuti

```
Implementa la segnalazione contenuti (Fase 7 del PRD v2): pulsante
"Segnala" visibile solo al genitore, tabella content_reports (storia,
famiglia segnalante, motivo, stato). Nessuna azione automatica sulla
storia in questa fase.
```

## Fase 8 — Reset password / verifica email

```
Verifica prima cosa Supabase Auth fornisce già di default per reset
password e verifica email nel progetto attuale. Se mancante, implementa
il flusso standard. Mostrami cosa hai trovato prima di costruire
qualcosa di nuovo.
```

## Fase 9 — Homepage SaaS

```
Implementa la homepage reale (Fase 9 del PRD v2): sezione "Come
funziona", pricing dei tre tier generato dalla stessa fonte
(PLAN_LIMITS in config.ts) usata dal checkout Stripe — mai hardcoded
separatamente, FAQ su sicurezza dati minori collegata alla privacy
policy. Mantieni la logica già esistente dei pulsanti in base allo
stato di login. Mostrami un confronto esplicito tra i prezzi mostrati
in homepage e quelli configurati per Stripe per confermare che
coincidano.
```

## Fase 10 — Pagina "Le mie storie" unificata

```
Implementa la Fase 10 del PRD v2: vista unificata storie generate +
preset con filtri per fascia d'età, bambino assegnato, titolo, stato lettura,
fonte. Distinta chiaramente dalla libreria Personaggi/Ambientazioni.
```

## Fasi 11-12 — Copertina illustrata / Audio (solo se confermate)

```
Prima di implementare, chiedimi conferma esplicita che vuoi procedere
con [copertina illustrata / narrazione audio] — erano segnate come
opzionali da validare con utenti reali, non funzionalità date per
scontate.
```

## Fase 13 — Sprint di design finale

```
Usa la skill storiia-design-system-audit. Avvia /browser e produci un
audit completo con screenshot reali di ogni pagina pubblica e
autenticata, desktop e mobile, di ogni menu di navigazione, ogni CRUD
(inclusi stati vuoti/errore/caricamento), la landing page e il funnel
di conversione, la pagina di gestione abbonamento. Valuta componente
per componente dove shadcn/ui sostituisce elementi esistenti (inclusi
eventuali window.confirm() nativi ancora presenti) e dove i componenti
attuali sono già coerenti e vanno mantenuti. Non implementare nulla:
producimi solo il report con screenshot e proposte, pagina per pagina.
Approverò le modifiche prima che tu scriva codice.
```
