# StoriIA — PRD Design System & UI/UX (Desktop & Mobile-First PWA)

Questo documento definisce in modo completo e autoritativo le linee guida estetiche, l'architettura di navigazione, la componentistica (`shadcn/ui`) e le specifiche tecniche di interfaccia per l'applicazione **StoriIA**. Funge da riferimento unico durante la **Fase 13 (Sprint di design finale)** del PRD V2 e per ogni futuro sviluppo visivo e di user experience.

---

## 1. Visione Generale e Filosofia Estetica

### 1.1 Identità Visiva e Tono del Brand
StoriIA è una piattaforma magica, sicura e di grado bancario pensata per le famiglie. L'interfaccia deve comunicare contemporaneamente **meraviglia infantile e robustezza/sicurezza per il genitore**.
- **Tema Base**: Dark Mode ad alto impatto visivo basato su **Glassmorphism** (`slate-950/90` di sfondo con card semitrasparenti in `slate-900/80` e bordi illuminati e sfocati con `backdrop-blur-xl`).
- **Palette Colori Curata (HSL Tokens in `index.css`)**:
  - **Primario / Accento Magico**: Gradienti dinamici da Indaco (`indigo-500`) a Viola (`purple-500`) a Rosa brillante (`pink-500`), utilizzati per le azioni di generazione AI, i bottoni primari e i brand mark.
  - **Avviso / Sicurezza**: Ambra (`amber-500/30`) per modali di restrizione piano e avvisi PIN; Smeraldo (`emerald-500`) per stati attivi e successi; Rosa/Rosso (`rose-500`) per azioni distruttive ed errori.
- **Micro-animazioni e Dinamicità**: Transizioni fluide sui passaggi di stato, hover reattivi sulle card (`hover:border-indigo-500/50 hover:shadow-lg`) e animazioni dolci all'apertura dei modali e dei drawer per rendere l'interfaccia viva ed engaging.

### 1.2 Dualità dell'Architettura: Desktop vs Mobile-First PWA
L'applicazione è progettata per operare con due paradigmi di navigazione distinti, massimizzando l'ergonomia del dispositivo in uso:
- **Desktop / Laptop (`md:` e superiori)**: Paradigma **SaaS Professionale ad Ampia Superficie**. Navigazione affidata a una **Sidebar verticale laterale**, separando nettamente le aree di consultazione da quelle di creazione AI e impostazioni.
- **Smartphone / Tablet (`md:hidden`)**: Paradigma **Progressive Web App (PWA) Nativa**. Navigazione affidata a una **Bottom Navigation Bar fluttuante in basso** con pulsante centrale rialzato per la creazione immediata (`+ AI`), barra superiore (`top bar`) alleggerita al massimo, e modali scorrevoli dal basso (**Bottom Sheet / Drawer** con maniglia di trascinamento).

---

## 2. Componentistica Core: Integrazione `shadcn/ui`

Per standardizzare l'applicazione e sostituire elementi ad-hoc o conferme native del browser (`window.confirm()`), StoriIA adotta **`shadcn/ui`** (costruito su **Radix UI** e **Tailwind CSS**).

### 2.1 Perché `shadcn/ui`
- **Ownership del Codice**: I componenti vengono copiati direttamente nel codice sorgente del progetto (`npx shadcn@latest add <componente>`) all'interno di `src/components/ui/`. Non vi è alcuna dipendenza da librerie di runtime esterne a rischio di breaking changes.
- **Accessibilità Nativa (WAI-ARIA)**: Navigazione da tastiera, gestione del focus magnetico nei modali e supporto screen reader integrati di default.
- **Coerenza Perfetta**: Ogni bottone, form, modale o tabella rispetta i token di stile e le animazioni definite a livello globale.

### 2.2 Componenti Prioritari per la Fase 13
1. **`Sidebar` (`src/components/ui/sidebar`)**: Gestione della barra laterale dell'area genitore su desktop.
2. **`Sheet` (`src/components/ui/sheet`)**: Utilizzato su mobile per la navigazione a cassetto dal basso (`side="bottom"`) durante l'inserimento di nuovi profili, personaggi, ambientazioni e filtri.
3. **`Dialog` & `AlertDialog` (`src/components/ui/dialog`, `alert-dialog`)**: Sostituzione di tutte le conferme di eliminazione, sospensione o avviso, con bottoni uniformati (*Annulla* grigio a sinistra, *Conferma/Elimina* a destra).
4. **`Tabs` (`src/components/ui/tabs`)**: Per l'Hub Impostazioni unificato (`/settings`) e per la navigazione tra sezioni nelle pagine complesse.
5. **`Card`, `Form` & `Input` (`src/components/ui/card`, `form`, `input`)**: Standardizzazione strutturale di tutti i moduli di creazione e modifica (con validazione associata) e delle card di selezione.
6. **`Select`, `Badge` & `Table` (`DataTable`)**: Per la barra dei filtri in "Le Mie Storie" e la visualizzazione nel Pannello di Amministrazione (`/admin`).

---

## 3. Architettura di Navigazione Detailed

### 3.1 Navigazione Desktop (`Sidebar` Verticale)
Su schermi desktop, l'header orizzontale in alto viene sostituito da una **Sidebar verticale a sinistra (`w-64 border-r border-slate-800 bg-slate-900/60 backdrop-blur-xl`)**.

```
+-----------------------------------+---------------------------------------------------+
|  [Logo StoriIA]                   |  [Barra Superiore: Notifiche | Modalità Bambino]  |
+-----------------------------------+---------------------------------------------------+
|  FAMIGLIA & LETTURA               |                                                   |
|   🏠 Dashboard                    |                                                   |
|   👦 Profili Figli                |                                                   |
|   📖 Le Mie Storie (Archivio)     |               AREA CONTENUTO PRINCIPALE           |
|                                   |                    (Max Width 7xl)                |
|  LIBRERIA CREATIVA                |                                                   |
|   ✨ Nuova Storia AI [CTA In Rilievo]|                                                |
|   🦸 Personaggi                   |                                                   |
|   🏰 Ambientazioni                |                                                   |
|                                   |                                                   |
|  -------------------------------  |                                                   |
|  ⚙️ Impostazioni Hub              |                                                   |
|  🛡️ Modalità Bambino [PIN Gate]   |                                                   |
|  🚪 Esci (Logout)                 |                                                   |
+-----------------------------------+---------------------------------------------------+
```

### 3.2 Navigazione Mobile-First PWA (`Floating Bottom Nav Bar`)
Su smartphone e tablet, l'interfaccia adotta una barra di navigazione fluttuante posizionata nella parte inferiore dello schermo, distanziata per rispettare la safe area di iPhone e Android.

- **Posizionamento e Stile**:
  `fixed bottom-4 left-4 right-4 max-w-md mx-auto h-16 rounded-3xl bg-slate-900/85 backdrop-blur-2xl border border-slate-800/80 shadow-2xl z-50 flex items-center justify-around px-2`

- **I 5 Ancoraggi Rapidi (Ergonomia del Pollice)**:
  ```
  +-----------------------------------------------------------------------+
  |  [ 🏠 ]        [ 📖 ]         [  ✨  ]         [ 🎨 ]        [ 👤 ]   |
  |   Home         Storie        Crea Storia      Libreria       Profilo  |
  +-----------------------------------------------------------------------+
  ```
  1. **🏠 Home (`/dashboard`)**: Panoramica rapida slot figli e azioni.
  2. **📖 Storie (`/stories`)**: Archivio favole pronte per la lettura.
  3. **✨ CREA AI (`/stories/new`) — Bottone Centrale Prominente**:
     Pulsante circolare rialzato e fluttuante (`-translate-y-3 w-13 h-13 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-indigo-500/40 flex items-center justify-center text-white font-bold`) che avvia istantaneamente la creazione magica della storia.
  4. **🎨 Libreria (`/library/characters` & `/library/settings`)**: Drawer rapido per selezionare o aggiungere personaggi e mondi.
  5. **👤 Profilo & Impostazioni (`/settings`)**: Accesso all'hub account genitore in stile app nativa.

- **Top App Bar Mobile Minima**:
  In alto su mobile resta una barra di altezza ridotta (`h-14`) contente unicamente:
  - Sinistra: Logo compatto **StoriIA**.
  - Destra: Campanella Notifiche (`NotificationBell`) e Badge/Scudo rapido **Modalità Bambino**.

---

## 4. Specifiche UI/UX per Rotta e Pagina

### 4.1 Pagine Pubbliche e Funnel d'Ingresso (`/`, `/login`, `/register`)
- **Landing Page (`/`)**:
  - *Hero Section*: Titolo ad alto impatto con gradiente testuale, sottotitolo sui vantaggi per lo sviluppo cognitivo e la sicurezza dei minori (GDPR Art. 8 / RLS). CTA doppia: `Inizia Gratis (20 Storie)` vs `Esplora Funzionalità`.
  - *Sezione Come Funziona*: 3 step illustrati (Scegli o crea il protagonista -> Seleziona età e morale -> L'AI genera la favola magica).
  - *Pricing Cards*: Tre card sincronizzate con `PLAN_LIMITS` (`free`, `premium`, `family`) in `config.ts`. Nessun prezzo deve mai essere hardcoded separatamente dal file di configurazione per evitare disallineamenti con Stripe.
- **Autenticazione (`/login`, `/register`)**:
  - Form centrati in una `Card` glassmorphic (`max-w-md w-full`).
  - Link ben leggibili: `Torna alla Home`, `Hai dimenticato la password?`, `Non hai un account? Registrati`.
- **Wizard Obbligatorio PIN Primo Accesso**:
  - Al primo login di una nuova famiglia, compare un `Dialog` bloccante (`Imposta il tuo PIN Genitore`) con due campi numerici 4-6 cifre (`inputMode="numeric" pattern="[0-9]*"`). Il PIN viene salato e hashato via `scrypt` prima di accedere alla dashboard.

### 4.2 Area Genitore — Dashboard (`/dashboard`)
- **Header Benvenuto**: Saluto personalizzato con contatore rapido delle storie generate nelle ultime 24 ore rispetto al limite (`es. 4 / 20 storie oggi`).
- **Card Slot Figli**: Griglia di card che mostrano gli avatar illustrati dei figli registrati. Ogni card presenta il nome, l'anno di nascita, e un pulsante d'azione rapida `Leggi Ultima Storia` o `Genera Favola per [Nome]`.
- **Quick Actions Bar**: Pulsanti rapidi per aggiungere un nuovo personaggio o accedere all'archivio.

### 4.3 Gestione Profili Bambino (`/children`)
- **Struttura Desktop vs Mobile**:
  - *Desktop*: Griglia ordinata delle card dei figli sulla pagina principale. In alto a destra, il pulsante primario `+ Nuovo Profilo Figlio` apre un `Dialog` modale animato con il modulo di inserimento.
  - *Mobile*: La pagina mostra la lista verticale o griglia 2 colonne dei figli. Al tocco del bottone `+ Nuovo Profilo`, il form scivola dal basso verso l'alto come un **Bottom Sheet (`Sheet side="bottom"`)** con maniglia di trascinamento.
- **Form Bambino & Picker Avatar**:
  - Campi: Nome (`Input`), Anno di nascita (`Input numerico`), Genere (`Select` o radio card iconiche: Maschio, Femmina, Neutro).
  - *Picker Avatar Illustrati*: Griglia di card selezionabili che mostrano le illustrazioni vettoriali gratuite di default (`Esploratrice Stellare`, `Piccolo Cavaliere`, `Volpe Saggia`, `Draghetto Curioso`, `Giovane Inventore`, `Astronauta Coraggioso`). Bordo evidenziato su card attiva.
- **Vincoli Piano (`PLAN_LIMITS`)**: Se l'utente raggiunge il limite del piano (es. 1 per *Free*), il pulsante di creazione viene disabilitato e mostra un tooltip/alert ambra con invito a estendere l'abbonamento (`/billing`).

### 4.4 Libreria Creativa (`/library/characters` & `/library/settings`)
- **Struttura (Separazione Lista e Form)**:
  - Come per `/children`, la pagina principale è dedicata alla **consultazione delle card esistenti** e alla visualizzazione di un **Empty State accattivante** se la libreria è vuota.
  - Il pulsante `+ Crea Personaggio` / `+ Crea Ambientazione` lancia un `Dialog` su desktop o uno `Sheet` dal basso su mobile.
- **Card Personaggio / Ambientazione**:
  - Titolo, icona o avatar associato, e descrizione.
  - *Tratti Caratteriali (Personaggi)*: Visualizzati sotto forma di `Badge` / chip multi-colorati (`es. Coraggioso`, `Curioso`, `Amante degli animali`).
- **Controllo Pre-Eliminazione (`AlertDialog`)**:
  - Se il genitore tenta di eliminare un personaggio o un'ambientazione già utilizzati in una o più storie salvate nell'archivio, scatta un `AlertDialog` ambra con avviso esplicito: *"Questo personaggio è attualmente utilizzato in X storie salvate. Eliminandolo, le storie esistenti preserveranno il testo ma perderanno il riferimento. Vuoi continuare?"*

### 4.5 Archivio Unificato "Le Mie Storie" (`/stories`)
- **Toolbar dei Filtri (`shadcn/ui Select & Input`)**:
  - Barra superiore fissa o scorrevole che permette di filtrare istantaneamente per:
    - *Ricerca testuale (`Input` con icona lente)* su titolo o contenuto.
    - *Fascia d'età*: `0-3 anni`, `4-6 anni`, `7-10 anni`, o `Tutte`.
    - *Profilo Assegnato*: Selettore dinamico dei figli della famiglia.
    - *Stato Lettura*: `Nuova`, `In Lettura`, `Letta`.
    - *Fonte*: `Generate dall'AI` vs `Preset di sistema`.
- **Card Storia**:
  - Titolo in risalto, tag con fascia d'età e morale (`Badge`), data di creazione.
  - *Footer Azioni Card*: Pulsante primario `Leggi Ora` (o `Continua Lettura`), e menu opzioni secondario per `Scarica PDF` (server-side, solo testo e privo di dati personali del bambino) e `Elimina Storia`.

### 4.6 Wizard Generatore Storie AI (`/stories/new`)
- **Interfaccia a Step (`Stepper` o Accordion guidato)**:
  - **Step 1: Destinatario ed Età**: Selezione opzionale del profilo bambino (se scelto, precompila automaticamente il selettore età dal `birth_year` calcolato rispetto a oggi, lasciando comunque la facoltà di modifica manuale al genitore).
  - **Step 2: Protagonista e Mondo**: Selezione dalla propria libreria di Personaggi (`/library/characters`) e Ambientazioni (`/library/settings`), oppure inserimento libero rapido.
  - **Step 3: Morale Educativa**: Scelta tra le morali gratuite di default (`L'importanza di condividere`, `Affrontare le piccole paure`, `Valore dell'amicizia`, ecc.) o, per i piani *Premium/Family*, inserimento di una morale personalizzata.
- **Feedback Generazione & Rate Limit**:
  - Indicatore chiaro delle storie rimanenti nelle 24 ore (`config.ts -> generationLimit.maxPerFamilyPer24Hours = 20`).
  - Durante la chiamata AI a `gemini-2.5-flash`, mostrare un indicatore di caricamento animato con frasi magiche a rotazione (*"L'AI sta intessendo la trama...", "Aggiungendo un pizzico di magia al bosco..."*).

### 4.7 Hub Impostazioni Genitore Unificato (`/settings`)
L'area impostazioni raggruppa in un unico punto tutte le configurazioni, accessibile su desktop via `Tabs` laterali/superiori e su mobile via menu a sezioni in stile **iOS / Android Settings App**.

```
+-------------------------------------------------------------------------------+
|  INTESTAZIONE ACCOUNT: Parent Email | Piano Attivo: PREMIUM [Badge Smeraldo]  |
+-------------------------------------------------------------------------------+
|  GRUPPO 1: FAMIGLIA & SICUREZZA                                               |
|   👦 Profili Figli (/children)          -> Gestisci avatar e slot bambini     |
|   🔑 PIN Sicurezza Modalità Bambino     -> Modifica PIN 4-6 cifre (scrypt)    |
|   👶 Entra in Modalità Bambino          -> CTA Rilievo: Blocca area genitore  |
+-------------------------------------------------------------------------------+
|  GRUPPO 2: ABBONAMENTO, CREDITI & FATTURAZIONE                                |
|   💎 Piano & Abbonamento (/billing)     -> Gestisci rinnovo o cambia tier     |
|   ⚡ Consumi e Crediti AI               -> Contatore giornaliero / mensile    |
|   🎁 Codici Regalo                      -> Riscatta o regala abbonamenti      |
+-------------------------------------------------------------------------------+
|  GRUPPO 3: PREFERENZE & PRIVACY (GDPR)                                        |
|   🔔 Notifiche                          -> Canali avvisi e promemoria lettura |
|   🔒 Dati e Privacy (GDPR)              -> Export archivio e cancellazione    |
|   ℹ️ Info / About StoriIA               -> Versione v2.0, Privacy Art. 8      |
+-------------------------------------------------------------------------------+
|  [ 🚪 ESCI DALL'ACCOUNT (LOGOUT - Bottone Rosso) ]                            |
+-------------------------------------------------------------------------------+
```

### 4.8 Area Bambino Immersiva & Lettore (`/child-select` & `/read`)
- **Selettore Bambino (`/child-select`)**:
  - Pagina a tutto schermo con sfondature magiche che presenta grandi card colorate con l'avatar di ciascun figlio. Al tocco, l'applicazione attiva il claim `active_child_profile_id` e applica il filtro fisico RLS su Postgres per le storie.
- **Interfaccia di Lettura (`/read`)**:
  - **Isolamento Immersivo**: Nessuna barra del menu genitore visibile. Sfondo morbido per non affaticare la vista (`slate-950` o tema pergamena scura ad alto contrasto text-friendly).
  - **Navigazione Pagine**: Testo diviso in blocchi/pagine leggibili con pulsanti di navigazione `[ Precedente ]` e `[ Successiva ]` ampi ed ergonomici (in mobile valutiamo anche lo swipe), progettati specificamente per il tocco delle dita di un bambino (`min-height: 56px`).
  - **Barra di Progresso**: Indicatore di completamento della storia in cima (`ProgressBar`).
  - **Gate Uscita (`Esci / Torna da Mamma e Papà`)**: Al tocco del bottone di uscita in alto a sinistra, scatta il modale bloccante di inserimento del **PIN Genitore di 4-6 cifre**. Senza il PIN corretto, il bambino non può in alcun modo tornare alla dashboard o modificare libreria e impostazioni.

---

## 5. Ergonomia Mobile, PWA & Accessibilità (Linee Guida Tecniche)

### 5.1 Touch Targets & Safe Area Insets
- **Dimensioni Minime Interattive**: Qualsiasi bottone, link, scheda tab o riga selezionabile su dispositivo touch deve possedere una dimensione minima o un'area di tocco utile di **`44x44px`** (standard Apple HIG / Google Material).
- **Rispettare la Safe Area iPhone/Android**:
  La Bottom Navigation Bar e i Bottom Sheet su mobile devono integrare la spaziatura del margine inferiore per evitare sovrapposizioni con l'indicatore di home swipe dei telefoni moderni:
  `pb-[env(safe-area-inset-bottom)]` e `mb-[env(safe-area-inset-bottom)]`.

### 5.2 Drawer & Bottom Sheet per le Azioni Mobile
Su schermi `md:hidden`, i modali di creazione e le toolbar di filtro non devono aprirsi al centro dello schermo coprendo il contenuto in modo rigido. Si deve utilizzare rigorosamente il componente **`Sheet` di shadcn impostato con `side="bottom"`**:
- Il cassetto scivola verso l'alto occupando dal 60% all'85% dell'altezza dello schermo.
- Include in cima una **maniglia grigia di trascinamento (`w-12 h-1.5 rounded-full bg-slate-700 mx-auto my-2`)** per comunicare all'utente la possibilità di chiudere il cassetto scorrendo verso il basso (`swipe down to dismiss`).

### 5.3 Accessibilità WAI-ARIA
- **Focus Ring**: Tutti gli elementi interattivi mantengono un contorno di focus chiaro per la navigazione da tastiera su desktop (`focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950`).
- **Screen Reader**: Ogni icona interattiva all'interno di bottoni (es. campanella, icona elimina, switch modalità bambino) è accompagnata da un'etichetta descrittiva `aria-label` o da un blocco testuale per ipovedenti (`sr-only`).

---

## 6. Protocollo Operativo di Esecuzione per la Fase 13

Durante lo sviluppo pratico della **Fase 13 (Sprint di design finale)**, l'agente e l'utente seguiranno questo iter rigoroso per garantire la perfezione visiva senza rotture logiche:

1. **Analisi e Screenshot Preventivo via `/browser`**:
   Prima di modificare una specifica rotta, l'agente avvia il browser locale su `http://localhost:3000/` e cattura lo screenshot reale della pagina in quello stato (desktop e mobile).
2. **Proposta e Piano di Refactoring `shadcn/ui`**:
   L'agente elenca puntualmente quali componenti ad-hoc verranno sostituiti (es. migrazione da `HeaderNav` a `Sidebar` su desktop e `BottomNav` su mobile, sostituzione modali con `Dialog`/`Sheet`).
3. **Approvazione dell'Utente**:
   Nessuna riga di codice viene modificata o aggiunta prima della conferma esplicita del piano da parte dell'utente.
4. **Implementazione & Verifica Integrale**:
   Dopo l'implementazione, viene rieseguito lo script di test automatico (`npm test -- --no-file-parallelism`) per garantire che i contratti RLS e le transazioni rimangano invariati, seguito dalla verifica visiva e dai nuovi screenshot post-fix su browser reale.
5. **Commit Manuale dell'Utente**:
   Come da regola di processo aurea (PRD V2 Art. 0), la fase o sotto-fase è conclusa solo alla conferma manuale dell'hash del commit di push da parte dell'utente.
