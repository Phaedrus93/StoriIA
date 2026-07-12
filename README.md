# StoriIA — Piattaforma AI Agentica di Favole Personalizzate per Bambini

**StoriIA** è una web application moderna ad alto impatto visivo pensata per le famiglie: consente ai genitori di creare favole su misura generate dall'intelligenza artificiale (**Google Gemini API**) e offre ai bambini un'interfaccia di lettura protetta, magica e priva di distrazioni.

---

## ✨ Funzionalità Principali

1. **Gestione Famiglia & Profili Bambino (`/children`)**:
   - Creazione di profili personalizzati per i figli con selezione di avatar magici dai preset gratuiti.
   - Protezione dell'area genitore tramite **PIN di sicurezza numerico (4-6 cifre)**.
2. **Sicurezza di Grado Bancario per la Tutela dei Minori**:
   - **Hashing `scrypt` conformità OWASP**: Il PIN non è mai salvato in chiaro, ma protetto con algoritmo memory-hard (`N=16384, r=8, p=5`).
   - **Isolamento Dati Sensibili (`family_security`)**: Nessuna policy `SELECT` aperta ai client; l'hash e lo stato di blocco sono accessibili unicamente via funzioni `SECURITY DEFINER`.
   - **Protezione Anti Brute-Force (Lockout)**: Blocco temporaneo automatico di 15 minuti dopo 5 tentativi di PIN errati consecutivi.
   - **Row Level Security (RLS) & Claim JWT**: In modalità bambino (`is_child_mode = true`), il database Postgres blocca fisicamente ogni tentativo di scrittura su libreria e storie e filtra la lettura ai soli contenuti assegnati al profilo attivo (`active_child_profile_id`).
3. **Character & Setting Builder (`/library/characters` & `/library/settings`)**:
   - Creazione di protagonisti e mondi incantati combinando preset educativi e dettagli personalizzati.
   - **Controllo Consapevole Pre-Eliminazione**: Se un personaggio o un'ambientazione sono già utilizzati in storie esistenti, il sistema mostra un avviso esplicito prima dell'eliminazione preservando l'integrità referenziale (`ON DELETE SET NULL`).
4. **Generatore di Storie AI su Misura (`/stories/new`)**:
   - Integrazione con **Google AI Studio (`gemini-2.5-flash`)** modulata sulla specifica fascia d'età:
     - `0-3 anni`: Tono dolce, frasi brevi e onomatopee per la nanna.
     - `4-6 anni`: Struttura fiabesca con piccolo mistero e morale chiara.
     - `7-10 anni`: Trama articolata in 3 atti con vocabolario ricco e sfide stimolanti.
   - **Soft Rate Limit**: Limite giornaliero di 20 storie gratuite per famiglia.
5. **Archivio Storie & Reader del Bambino (`/stories` & `/read`)**:
   - Assegnazione dinamica delle storie ai figli con tracking del progresso di lettura (`last_read_position` e stato `Nuova / In Lettura / Letta`).
   - Interfaccia bambino immersiva con uscita protetta da PIN per tornare alla dashboard genitore.

---

## 🛠️ Stack Tecnologico

- **Framework Core**: Next.js 16 (App Router) con TypeScript e React 19.
- **Database & Autenticazione**: Supabase (PostgreSQL, Row Level Security, RPC Security Definer, Auth SSR).
- **Intelligenza Artificiale**: Google GenAI SDK (`@google/genai`) con modello `gemini-2.5-flash`.
- **Styling**: Vanilla CSS avanzato (`index.css`) con design system ad alto impatto visivo (Glassmorphism, gradienti HSL e micro-animazioni).
- **Testing**: Vitest + PGlite per test automatici unitari e di integrazione reale sul motore SQL in-memory.

---

## 🚀 Guida all'Avvio Automatico con Supabase Docker in Rete Locale (LAN/Wi-Fi)

Il progetto è preconfigurato per avviare l'intero stack locale (**Supabase in Docker + Next.js**) con un singolo clic, rendendo l'applicazione immediatamente accessibile sia dal tuo PC che da tablet o smartphone sulla stessa rete Wi-Fi.

### 1. Prerequisiti
- **Node.js** (20.x o successiva).
- **Docker Desktop** installato e in esecuzione sul tuo PC (richiesto per avviare Supabase in locale).

### 2. Installazione Dipendenze
Al primo utilizzo, apri il terminale ed esegui:
```bash
npm install
```

### 3. Avvio con Un Singolo Clic (`avvia-storiia-lan.bat`)
Fai doppio clic sul file **`avvia-storiia-lan.bat`** presente nella cartella del progetto. Lo script automatizza il flusso in istanze separate per evitare qualsiasi crash:
1. **Rileva il tuo indirizzo IP locale** sulla rete Wi-Fi/LAN (es. `192.168.0.88`).
2. **Avvia Supabase locale tramite Docker** (`npx supabase start`), applicando automaticamente le migrazioni e lo schema SQL (`supabase/migrations/`).
3. **Avvia Next.js in una finestra indipendente su `0.0.0.0:3000`** e mostra a schermo il link da aprire su **tablet**, **smartphone** o **PC**:
   ```
   http://192.168.x.x:3000
   ```
*(Nota: Il file `.env.local` viene gestito manualmente da te senza modifiche automatiche da parte dello script).*

---

## 🧪 Esecuzione della Suite di Test Automatici

Il progetto include **30 test automatici** divisi in 6 suite che verificano l'isolamento RLS, l'hashing OWASP del PIN, la protezione Lockout anti brute-force e la logica applicativa pre-eliminazione:

```bash
npm test
```

### Elenco Suite di Test Automatiche:
- **`src/tests/security-rls.test.ts`**: Verifica delle policy logiche di sicurezza RLS e filtro su `active_child_profile_id`.
- **`src/tests/pin-security.test.ts`**: Verifica salatura e hashing `scrypt` OWASP del PIN e calcolo sblocco temporale.
- **`src/tests/security-rls-integration.test.ts`**: Esecuzione reale in motore PostgreSQL in-memory (`PGlite`) per verificare il blocco fisico delle query in modalità bambino e l'isolamento di `family_security`.
- **`src/tests/library-pre-delete.test.ts`**: Verifica conteggi pre-eliminazione su personaggi e ambientazioni e integrità referenziale `ON DELETE SET NULL`.
- **`src/tests/story-generation.test.ts`**: Verifica del prompt engineering differenziato per fasce d'età e del Soft Rate Limit di 20 storie giornaliere.
- **`src/tests/child-mode.test.ts`**: Verifica transizioni verso modalità bambino e protezione Lockout anti brute-force dopo 5 tentativi PIN errati.
