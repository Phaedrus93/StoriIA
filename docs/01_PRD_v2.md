# StoriIA — PRD v2 (Blocco 3, definitivo)

Stato dei blocchi precedenti: **MVP e v1 completati e verificati codice
alla mano** (crediti atomici, Stripe con idempotenza webhook, downgrade/
riattivazione senza bypass, moderazione a doppio livello fail-closed,
RLS cross-famiglia, gamification con tetti calendario). Questo documento
copre solo il Blocco 3 (v2): cosa resta, in che ordine, con quali criteri
di accettazione.

---

## 0. Regola di processo, non negoziabile

Ogni fase di questo blocco segue lo stesso protocollo già rodato nei
blocchi precedenti:

1. L'agente propone il piano prima di scrivere codice
2. Implementazione
3. Test automatici reali (PGlite/mock reali, mai simulazioni con
   variabili locali che non chiamano codice applicativo)
4. **Commit e push manuali fatti dall'utente** (non dall'agente in questa
   fase) — l'agente non dichiara mai "fatto" prima che l'utente confermi
   l'hash del commit
5. Solo dopo la conferma dell'hash, si passa alla fase successiva

Nessuna fase è considerata completa sulla base di un riepilogo testuale.
La prova è sempre: file reale nel repository, test reale eseguito, hash
di commit confermato.

---

## 1. Ordine delle fasi v2

L'ordine non è arbitrario: prima le funzionalità che toccano dati e
logica di business (rischio di rottura più alto, valore indipendente
dall'estetica), poi le funzionalità di superficie, **il design system
per ultimo** — deve analizzare un'applicazione già funzionalmente
completa, non rincorrere funzionalità che cambiano forma nel frattempo.

1. Export PDF della storia
2. Età automatica dal profilo bambino in generazione storia
3. Area impostazioni utente unificata
4. Pannello admin (preset, testi, config — mai API key)
5. Sistema di log/debug con redazione automatica
6. Regalo crediti/abbonamento
7. Segnalazione contenuto problematico
8. Reset password / verifica email (verificare prima cosa copre già
   Supabase Auth di default)
9. Homepage reale da SaaS (marketing, pricing, FAQ)
10. Pagina "Le mie storie" unificata (generate + preset)
11. Copertina illustrata (opzionale, solo se ancora desiderata a questo punto)
12. Narrazione audio (opzionale, solo se validata da utenti reali)
13. **Sprint di design finale** — analisi e rifinitura dell'intera
    applicazione

---

## 2. Specifica dettagliata per fase

### Fase 1 — Export PDF storia

- Solo testo (coerente con la scelta "niente illustrazioni ad-hoc")
- Pulsante "Scarica PDF" nell'archivio storie e nella vista dettaglio
- Contenuto: titolo, testo della storia, fascia d'età, morale (se
  presente), data di generazione. Nessun dato del bambino a cui è
  assegnata nel PDF stesso (il PDF può girare, il profilo del bambino
  no) — decisione di privacy by design, non solo estetica
- Generazione lato server (route dedicata), libreria consigliata: una
  libreria PDF Node-native leggera; evitare soluzioni che richiedono un
  browser headless per un documento di solo testo — inutilmente pesante
- Criterio di accettazione: PDF scaricabile per una storia
  `ai_generated` e una `preset`, testo integrale e leggibile, nessun
  dato del profilo bambino incluso

### Fase 2 — Età automatica dal profilo bambino

- In `/stories/new`: la selezione di un bambino specifico è
  **opzionale** (non obbligatoria) — se selezionato, calcola la fascia
  d'età dal suo `birth_year`, ma resta **modificabile manualmente**
  prima di generare
- Se nessun bambino è selezionato, si sceglie la fascia d'età a mano
  come già oggi — necessario per mantenere la possibilità di generare
  storie "neutre" assegnabili a più fratelli di età diverse (non
  rompere l'architettura `story_assignments` già validata)
- Criterio di accettazione: selezionare un bambino nato nel 2021 in
  luglio 2026 pre-seleziona la fascia `4-6`; l'utente può comunque
  cambiarla; generare senza selezionare nessun bambino funziona come
  oggi

### Fase 3 — Area impostazioni utente unificata

Un hub unico raggiunto da un solo punto di ingresso in navigazione, con
sezioni chiaramente separate (tab o sidebar interna, non pagine isolate
scollegate):
- **Account**: email, cambio password
- **Sicurezza modalità bambino**: PIN (già in `/profile`, da migrare qui)
- **Fatturazione e abbonamento**: stato piano, storico, annulla/riattiva/
  downgrade (già in `/billing/manage`, da integrare qui o linkare
  chiaramente)
- **Notifiche**: preferenze canali/eventi
- **Dati e privacy**: export dati, eliminazione account (GDPR)

Criterio di accettazione: nessuna funzione di gestione account esiste
ancora in una pagina isolata non raggiungibile da questo hub.

### Fase 4 — Pannello admin

- Gestione preset avatar, missioni/badge gamification, testi fissi,
  morali predefinite, storie preset, parametri di configurazione
  applicativa
- **API key sempre escluse**: nessuna chiave (Gemini, Stripe, service
  role Supabase) gestibile o visibile da questa interfaccia, in nessuna
  forma, nemmeno mascherata — restano solo in variabili d'ambiente
- Accesso: solo il tuo utente (hardcoded per user id o email in questa
  fase, non serve un sistema di ruoli complesso per un solo
  amministratore)
- Criterio di accettazione: un utente non-admin che tenta di accedere
  alle route admin riceve 403, verificato con un test che simuli un
  utente normale

### Fase 5 — Log/debug con redazione

- Livello di verbosità controllato da `config.ts`, default `basic` in
  produzione
- Redazione automatica di: nome bambino, testo storia generata, email,
  PIN (ovviamente mai loggato in nessun caso), qualunque campo elencato
  in `redactedFields` del config già esistente
- Retention breve (7 giorni) se il livello verboso viene attivato
  temporaneamente
- Criterio di accettazione: un test che attiva il log verboso e
  verifica che i campi sensibili non compaiano mai in chiaro nell'output

### Fase 6 — Regalo crediti/abbonamento

- Flusso completo: acquisto di un codice regalo (crediti o
  abbonamento), invio/condivisione del codice, riscatto da parte di un
  altro account
- Tabella `gift_codes` (già prevista nel data model v1/v2): codice,
  tipo, importo/tier, chi l'ha riscattato, quando
- Nessuna concessione di crediti/tier avviene senza conferma webhook
  Stripe per l'acquisto iniziale del codice (stesso principio già
  applicato ovunque nel sistema di pagamenti)

### Fase 7 — Segnalazione contenuto problematico

- Pulsante "Segnala" su ogni storia visibile al genitore (non al
  bambino)
- Tabella `content_reports`: storia, famiglia segnalante, motivo, stato
- Nessuna azione automatica sulla storia segnalata in questa fase (la
  gestisci tu manualmente all'inizio, non serve un flusso di
  moderazione umana completo per un singolo amministratore)

### Fase 8 — Reset password / verifica email

- Verificare innanzitutto cosa Supabase Auth fornisce già di default
  (spesso reset password è già incluso) prima di costruire qualcosa di
  custom
- Se mancante: flusso standard email con link temporaneo

### Fase 9 — Homepage reale da SaaS

- Sezione "Come funziona" (3 step, già bozzata in un giro precedente)
- Pricing dei tre tier **collegato a un'unica fonte di verità** (gli
  stessi `PLAN_LIMITS` di `config.ts` usati da Stripe checkout) — mai
  prezzi hardcoded separatamente nella pagina marketing, altrimenti si
  disallineano silenziosamente da quello che Stripe fattura davvero
- FAQ su sicurezza dati minori (collegata alla privacy policy)
- CTA coerenti con lo stato di login già implementato (Accedi/Registrati
  vs Dashboard/Logout)

### Fase 10 — Pagina "Le mie storie" unificata

- Storie generate + preset in un'unica vista, filtri per fascia d'età,
  bambino assegnato, stato lettura, fonte (`ai_generated`/`preset`)
- Distinta chiaramente da Personaggi/Ambientazioni (libreria di
  creazione, non di consultazione)

### Fase 11-12 — Copertina illustrata / Audio (opzionali)

Solo se, dopo tutto il resto, decidi ancora di volerli — erano stati
segnalati come scommessa di posizionamento da validare con utenti
reali, non come funzionalità date per scontate.

---

## 3. Fase 13 — Sprint di design finale

Questa fase avviene **per ultima**, quando tutte le funzionalità sopra
sono implementate e stabili. Obiettivo: analisi e rifinitura completa
di ogni pagina, menu, componente — livello "SaaS pubblicato in
produzione", non prototipo.

### Perimetro dell'analisi

L'agente deve produrre, prima di scrivere codice, un audit completo
(con `/browser` e screenshot reali, come già fatto in passato — mai
un'analisi statica del codice spacciata per verifica visiva) di:
- Ogni route pubblica e autenticata, desktop e mobile
- Ogni menu di navigazione (header, sidebar, footer)
- Ogni CRUD (creazione, modifica, eliminazione — inclusi stati di
  conferma, caricamento, errore, vuoto)
- La landing page e il funnel di conversione completo
- La pagina di gestione abbonamento
- Coerenza dei componenti (bottoni, modali, card, form) tra tutte le
  pagine

### Libreria di componenti consigliata

Per un'applicazione Next.js + Tailwind come StoriIA, la scelta più
adatta nel 2026 resta **shadcn/ui**: non è una dipendenza da installare
e aggiornare come una libreria tradizionale, ma componenti che vengono
copiati direttamente nel codice del progetto (tramite CLI: `npx
shadcn@latest add <componente>`), quindi restano modificabili al 100%
senza vincoli di versione esterna — adatto al modo in cui abbiamo
sviluppato finora con l'agente. È costruita su Radix UI (accessibilità
WAI-ARIA integrata, navigazione da tastiera corretta di default),
usata in produzione da aziende come OpenAI e Adobe.

Componenti rilevanti per StoriIA specificamente:
- `sidebar` per la navigazione principale dell'area genitore
- `data-table` (o l'estensione TanStack Table già integrata nell'
  ecosistema shadcn) per l'archivio storie e il pannello admin
- `dialog`/`alert-dialog` per sostituire eventuali conferme native del
  browser rimaste
- `form` (integrato con validazione) per tutti i form di creazione/
  modifica già esistenti
- `stepper` per il wizard di generazione storia a step
- Blocchi di pricing/landing già pronti nell'ecosistema (repository
  come `awesome-shadcn-ui` raccolgono sezioni pricing, hero, FAQ pronte
  da adattare, invece di disegnarle da zero)

Non è necessario riscrivere tutta l'interfaccia esistente da zero:
l'agente deve valutare, pagina per pagina, dove i componenti attuali
sono già coerenti (mantenerli) e dove necessitano sostituzione o
rifinitura (es. il `window.confirm()` nativo già segnalato in
passato, se non ancora sistemato).

### Criterio di accettazione della fase 13

- Nessuna pagina manca di stato vuoto, di errore, di caricamento
- Nessun componente con lo stesso ruolo (bottone di conferma, modale di
  eliminazione) ha stile diverso tra pagine diverse
- Menu di navigazione coerente e completo su ogni pagina autenticata,
  desktop e mobile
- Pricing in homepage generato dalla stessa fonte usata da Stripe,
  verificato con un confronto diretto tra i due
- Report finale con screenshot reali per ogni pagina, non un'
  affermazione generica di completamento

---

## 4. Promemoria legale, invariato dal blocco precedente

Prima di qualunque lancio pubblico reale (non più solo parenti/beta
fidata): le pagine legali già scritte sono bozze e richiedono
validazione da un professionista, specialmente ora che la homepage
mostrerà prezzi reali e inviterà pubblicamente alla registrazione — a
quel punto le tutele UE su recesso e disdetta diventano pienamente
applicabili, non più un rischio teorico.
