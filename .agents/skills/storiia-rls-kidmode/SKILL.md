# Skill: storiia-rls-kidmode

## Quando usarla
Ogni volta che si implementa o si modifica qualunque endpoint, route
handler, o RLS policy che riguarda la modalità bambino.

## Principio

Il blocco della modalità bambino è una garanzia di sicurezza, non un
dettaglio di UX. Nascondere bottoni in UI NON è sufficiente e non va mai
considerato completo senza il corrispondente controllo lato backend.

## Requisiti concreti

- La sessione "modalità bambino" deve portare un claim/flag verificabile
  lato server (non solo uno stato React/client)
- Ogni endpoint di scrittura su characters, settings, stories,
  credits_ledger (v1), subscriptions (v1), account (delete/update) deve
  rifiutare la richiesta se il flag "modalità bambino" è attivo,
  indipendentemente da cosa la UI permetterebbe di fare
- Ogni volta che questa skill è coinvolta, l'agente deve scrivere anche
  un test che tenti di chiamare l'endpoint protetto direttamente (non
  tramite click UI) in sessione "modalità bambino", per verificare che
  venga rifiutato
- In caso di dubbio su un nuovo endpoint, chiedi esplicitamente "questo
  endpoint deve essere raggiungibile in modalità bambino?" prima di
  implementarlo, invece di assumere di sì o di no
