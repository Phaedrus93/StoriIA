# Skill: storiia-design-system-audit

## Quando usarla

Solo nella Fase 13 (sprint di design finale) del PRD v2, quando tutte
le altre funzionalità sono già implementate e stabili. Non usarla per
rifiniture estetiche isolate durante lo sviluppo delle fasi precedenti
— il design system arriva per ultimo di proposito, per non rincorrere
funzionalità che cambiano forma nel frattempo.

## Libreria di riferimento: shadcn/ui

Componenti copiati direttamente nel codice del progetto (`npx
shadcn@latest add <componente>`), costruiti su Radix UI (accessibilità
integrata), pienamente compatibili con Next.js App Router e Tailwind
già in uso in questo progetto. Non introduce un runtime esterno da
aggiornare: il codice copiato resta modificabile al 100% dal progetto
stesso.

Componenti prioritari per StoriIA:
- `sidebar` — navigazione area genitore
- `data-table` — archivio storie, pannello admin
- `dialog` / `alert-dialog` — tutte le conferme (sostituire eventuali
  `window.confirm()` rimasti)
- `form` — tutti i form di creazione/modifica esistenti
- `stepper` — wizard generazione storia
- Blocchi pricing/hero/FAQ già pronti nell'ecosistema shadcn, da
  adattare invece di disegnare da zero per la homepage

## Metodo di lavoro obbligatorio

1. Usa `/browser` per navigare fisicamente ogni pagina, desktop e
   mobile — mai un'analisi statica del codice spacciata per verifica
   visiva (vedi storiia-verification-protocol)
2. Screenshot reale per ogni pagina prima di proporre modifiche
3. Report strutturato per pagina: cosa mantenere, cosa sostituire,
   perché
4. Nessuna modifica implementata prima dell'approvazione esplicita del
   report

## Checklist di coerenza da verificare esplicitamente

- Bottoni con lo stesso ruolo (conferma, annulla, elimina) hanno lo
  stesso stile su ogni pagina
- Ogni pagina ha stato vuoto, di errore, di caricamento gestito
- Menu di navigazione identico e completo su ogni pagina autenticata
- Pricing homepage generato dalla stessa fonte (`PLAN_LIMITS` in
  `config.ts`) usata da Stripe checkout, mai hardcoded separatamente
- Nessuna pagina raggiungibile solo tramite URL diretto senza un
  percorso di navigazione visibile
