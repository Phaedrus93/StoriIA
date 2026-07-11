# StoriIA v2 — Product Requirements Document

## Visione

SaaS web responsive (mobile in futuro, non ora) per genitori italiani che
creano storie testuali personalizzate per i propri figli (età reale
supportata dal testo: 0-10 anni; auto-lettura in modalità bambino: 4/5-10
anni) tramite AI. Nessuna illustrazione generata ad-hoc: solo testo, per
scelta di posizionamento ("lettura attiva, non ascolto passivo") e per
evitare il problema tecnico più costoso del settore (coerenza illustrativa
pagina per pagina).

## Wedge competitivo (perché qualcuno dovrebbe scegliere StoriIA)

- Mercato italiano: la quasi totalità dei competitor (Lullaby, ToonyStory,
  Story Spark, BedtimeStory.ai, Askie, LoveToRead.ai) è anglofona
- Modalità bambino con blocco funzioni a pagamento enforced lato backend,
  non solo estetico
- Nessuna foto reale di minori in nessun punto del prodotto
- Moralità/insegnamento opzionale selezionabile, non generico
- Leva culturale italiana: crediti/abbonamento regalabili (nonni)

## Target reale e vincoli d'età

- Generazione storie: fascia d'età target 0-10, selezionata al momento
  della creazione (non legata a un bambino fisso, vedi data model)
- Modalità bambino (auto-lettura): pensata per 4/5-10 anni. Sotto questa
  fascia, il genitore legge dal proprio account.

## Struttura account

- Un solo genitore admin per account (nessun co-genitore con pieni
  permessi, in questa versione)
- N profili bambino per famiglia, secondo tier (vedi economia)
- Personaggi e ambientazioni: libreria di proprietà di un bambino
  specifico, ma selezionabile da tutta la famiglia al momento della
  generazione di una storia per un altro figlio
- Storie: non legate in modo esclusivo a un bambino. Una storia generata
  può essere assegnata (letta) da più fratelli. Il progresso di lettura
  è per coppia storia-bambino, non per storia

---

## BLOCCO 1 — MVP (uso personale, test con la famiglia)

Obiettivo: verificare che il flusso core funzioni e sia piacevole da usare
con un utente vero (tua figlia), prima di qualunque investimento in
billing, legale o infrastruttura pubblica.

**Dentro:**
- Auth semplice Supabase (solo genitore, email/password)
- Profilo/i bambino: crea, modifica, elimina; avatar da preset grafico
  gratuito (nessuna foto reale, nessun preset a pagamento ancora)
- Character builder: preset di tratti + campo custom libero, salvato
  nella libreria del bambino, selezionabile per generare storie di
  qualunque figlio della famiglia
- Setting builder: stessa logica del character builder
- Generazione storia: chiamata a Google AI Studio (Gemini API), input =
  personaggio + ambientazione + fascia d'età + morale (lista predefinita,
  tutta gratuita in MVP, nessun sistema punti ancora)
- Libreria storie: lista, apri, elimina; sezioni "nuove"/"in corso"/"lette"
  con "continua a leggere" basato su `last_read_position`
- Modalità bambino: modalità di sola lettura, senza accesso a creazione
  personaggi/ambientazioni/storie, enforced anche lato backend (non solo UI)
- Config centralizzato in un unico file da subito (vedi `05_config.example.ts`)
- Log di base per debug (senza sistema di redazione avanzato — in MVP i
  dati sono solo i tuoi, ma non abituarti a lasciare log verbosi accesi
  di default: è comunque testo su tuo figlio)
- Rate limit soft anti-abuso (es. 20 generazioni/giorno) solo per evitare
  bug che generano loop di chiamate costose all'AI, non per limitare l'uso

**Fuori (esplicitamente rimandato):**
- Nessun sistema crediti/abbonamento/pagamento
- Nessuna pagina legale (uso personale, non pubblico)
- Nessuna moderazione automatica dei contenuti (rivedi tu i testi finché
  resta in famiglia — ma NON saltare questo prima di invitare altri)
- Nessun sistema punti/badge/gamification
- Nessun pannello admin
- Nessuna notifica

---

## BLOCCO 2 — v1 (primi utenti reali fuori dalla tua famiglia)

Obiettivo: rendere il prodotto sicuro e monetizzabile per un piccolo
gruppo di utenti esterni (beta chiusa), non ancora lancio pubblico ampio.

**Aggiunte:**
- Sistema crediti (senza scadenza) + integrazione Stripe
- Tier di abbonamento:
  - **Free**: 1 bambino, crediti iniziali una tantum (non ricorrenti,
    es. 3-5 crediti alla registrazione), solo morali base gratuite
  - **Premium**: 3 bambini, crediti mensili inclusi, prezzo credito extra
    scontato, tutte le morali sbloccate
  - **Family**: 6 bambini, più crediti inclusi, miglior prezzo credito
    extra, funzione regalo prioritaria
  - **Add-on**: profilo singolo aggiuntivo su qualunque piano, piccolo
    prezzo fisso mensile
- Moderazione contenuti: input (creazione personaggio/ambientazione) e
  output (storia generata), con retry automatico gratuito (max 1) in caso
  di blocco; se fallisce ancora, credito non scalato, errore generico
  esposto all'utente, motivo reale loggato internamente in forma redatta
- Pagine legali complete: termini di servizio, privacy policy con
  menzione esplicita del trattamento dati minori, cookie policy —
  **da far validare da un legale prima di renderle attive per utenti
  reali esterni alla famiglia**
- Cancellazione account con eliminazione reale dei dati minori + export
- Freeze/unfreeze abbonamento: pagamento fallito → account congelato
  (mai eliminato) → sbloccato al ripagamento, pagine dedicate
- Downgrade tier: profili in eccesso sospesi (non cancellati),
  riattivabili a scelta del genitore
- Sistema punti gamification: guadagnati generando/leggendo storie/
  missioni; spendibili solo su cosmetica (preset avatar extra, morali
  extra, temi) — mai convertibili in generazioni gratuite illimitate
  (eccezione tollerata: max 1 storia gratis/mese da punti, tetto basso)
- Badge legati a missioni enumerate in tabella dedicata
- Notifiche base (almeno email: promemoria, continua a leggere)
- Rate limit reale a 20 storie/giorno per account (rete di sicurezza,
  non leva di business)

---

## BLOCCO 3 — v2 (prodotto completo, pronto al lancio pubblico)

Obiettivo: tutto ciò che serve per operare il prodotto a scala, senza
intervento manuale continuo da parte tua.

**Aggiunte:**
- Pannello admin: gestione preset avatar, missioni/badge, testi fissi,
  morali predefinite, configurazioni applicative — **API key escluse**,
  gestite solo via variabili d'ambiente/secret manager
- Sistema di log/debug completo: livello massimo attivabile via config,
  con redazione automatica dei dati personali e retention breve (es. 7
  giorni), mai attivo permanentemente in produzione
- Regalo crediti/abbonamento (flusso completo, non solo meccanica dati)
- Segnalazione contenuto problematico da parte del genitore
- Gestione mezzo di pagamento e storico fatture (Stripe billing portal
  o equivalente custom)
- Reset password e verifica email (se non già coperti da Supabase Auth
  di default — verificare in fase v1, ma va comunque validato qui)
- Design system completo e rifinitura UI/UX di ogni schermata (stati
  vuoti, di errore, di caricamento, onboarding prima generazione)
- Eventuale copertina illustrata (unico elemento visivo, rischio/costo
  contenuto rispetto a illustrare tutte le pagine)
- Eventuale narrazione audio (solo dopo validazione che il pubblico la
  richieda davvero — non presente nel posizionamento iniziale)

**Prima del lancio pubblico, non negoziabile:**
- Consulenza legale reale su: trattamento dati minori (GDPR), diritto di
  recesso su acquisti digitali, facilità di disdetta abbonamento
  (dark pattern = rischio legale concreto in UE)
- Verifica che ogni pagina legale sia stata scritta/validata da un
  professionista, non solo generata

---

## Economia — riepilogo

- Due valute separate: **crediti** (pagati, generazione storie, senza
  scadenza) e **punti** (gratuiti, azioni, spendibili solo su cosmetica)
- Il credit system è l'unica leva di ricavo diretto — non va mai diluito
  dalla gamification
