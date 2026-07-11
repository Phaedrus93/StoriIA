# Skill: storiia-credit-system

## Quando usarla
Blocco v1 in poi. Ogni volta che si tocca credits_ledger, generazione
storia con costo in crediti, o punti gamification.

## Principi non negoziabili

- Crediti e punti sono due valute separate. I punti gamification NON
  sono mai convertibili in generazioni gratuite illimitate — al massimo
  un tetto basso e a bassa frequenza (es. 1 storia gratis/mese), mai un
  cambio libero
- I crediti non scadono (deciso esplicitamente): nessuna colonna
  `expires_at` va aggiunta senza conferma esplicita dell'utente umano
- Lo scalo del credito avviene SOLO dopo generazione riuscita (incluso
  passaggio moderazione output, in v1+). Se la generazione o la
  moderazione falliscono, il credito non va mai scalato
- In caso di retry automatico dopo fallimento moderazione, il retry non
  consuma un secondo credito
- Ogni operazione su credits_ledger deve essere idempotente: un errore
  di rete che causa un doppio invio della stessa richiesta non deve
  scalare il credito due volte (usa una chiave di idempotenza per
  richiesta di generazione)
