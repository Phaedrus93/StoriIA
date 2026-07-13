# Skill: storiia-payments-security

## Quando usarla

Ogni volta che si tocca credit_ledger, subscription_tier, Stripe
(checkout, webhook, cancellazione, riattivazione), downgrade/upgrade di
piano, o qualunque endpoint che modifica lo stato economico di una
famiglia.

## Principi non negoziabili, ricavati da bug reali trovati in questo progetto

- **La fonte di verità per crediti/tier è sempre il webhook Stripe
  server-to-server, mai una risposta di successo lato client.** Un
  popup o un redirect di "successo" può migliorare la UX, ma non deve
  mai essere la condizione che sblocca crediti o cambia tier — un bug
  reale in questo progetto derivava da un webhook mai raggiunto in
  locale (mancava lo Stripe CLI), e da un endpoint di cancellazione che
  aggiornava solo il database locale senza mai chiamare l'API Stripe
  vera.
- **Ogni endpoint che cambia tier deve verificare la gerarchia dei
  piani** prima di applicare il cambio. Un endpoint di downgrade che
  non verifica se il nuovo tier è realmente inferiore a quello attuale
  permette un upgrade gratuito bypassando Stripe — bug reale già
  trovato e corretto in questo progetto. Upgrade avviene SOLO tramite
  Stripe Checkout, mai da un endpoint diretto.
- **Idempotenza sempre esplicita sugli eventi webhook.** Stripe può
  reinviare lo stesso evento più volte; senza una tabella che tracci
  gli `event.id` già processati, un evento duplicato accredita crediti
  o attiva un piano due volte. Ogni handler deve controllare prima se
  l'evento è già stato processato.
- **Cancellazione e riattivazione abbonamento devono sempre chiamare
  l'API Stripe reale** (`cancel_at_period_end: true/false`), aggiornare
  il database locale solo dopo conferma di successo da Stripe, mai
  prima. Se Stripe fallisce, l'utente deve vedere un errore esplicito,
  mai una falsa conferma.
- **Ogni limite economico (add-on profili, tier massimo) va verificato
  server-side prima di ogni operazione che lo tocca**, non solo
  mostrato/nascosto in UI.
- **Scalo crediti sempre atomico a livello database** (pattern `UPDATE
  ... WHERE credits_balance > 0` con verifica delle righe modificate),
  mai un controllo-poi-scrittura in due passaggi separati lato
  applicazione, che introduce race condition sotto richieste
  concorrenti.

## Test richiesti per ogni nuovo endpoint di pagamento

- Simulazione dello stesso evento webhook ricevuto due volte: verifica
  che l'azione avvenga una sola volta
- Tentativo di upgrade diretto (bypassando Stripe) su qualunque
  endpoint di cambio tier: deve essere rifiutato
- Fallimento simulato della chiamata Stripe: verifica che il database
  locale non cambi stato
- Tutti questi test devono chiamare il codice applicativo reale
  (handler/funzione esportata), mai reimplementare la logica nel test
  stesso — vedi skill storiia-verification-protocol
