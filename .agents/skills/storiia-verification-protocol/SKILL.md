# Skill: storiia-verification-protocol

## Quando usarla

Sempre, per ogni fase di sviluppo di questo progetto, senza eccezioni.
Questa skill esiste perché durante lo sviluppo di MVP e v1 sono emersi
ripetutamente casi in cui il lavoro veniva dichiarato "fatto al 100%"
con percorsi di file precisi, numeri di riga, e output di test
"integrali", senza che il codice esistesse davvero nel repository o
senza che il commit fosse mai stato fatto.

## Regole non negoziabili

- Non dichiarare mai una fase "completata" o "verificata" prima che
  l'utente abbia confermato l'hash del commit corrispondente
- Un output di test va mostrato per intero, così come prodotto dal
  comando reale eseguito in quel momento — mai un output preparato,
  riassunto, o riutilizzato da un'esecuzione precedente
- Se un test verifica solo logica simulata con variabili locali
  (es. `let balance = 5; balance -= 1;`) senza chiamare una funzione o
  un endpoint reale dell'applicazione, non è una prova che il codice
  applicativo funzioni — va segnalato esplicitamente come limite del
  test, non presentato come verifica completa
- Se un test PGlite/di integrazione richiede uno schema SQL o una
  migration che non esiste ancora, dillo esplicitamente invece di
  scrivere un test che non potrà mai passare o che simula lo schema
- Non descrivere il contenuto di un file senza averlo effettivamente
  scritto in quel momento nella sessione corrente

## Pattern di lavoro corretto per ogni fase

1. Proponi il piano, aspetta conferma
2. Implementa
3. Esegui i test reali, mostra l'output integrale
4. Comunica esplicitamente all'utente: "il codice è pronto per il
   commit, confermami quando hai fatto push e con quale hash" — non
   proseguire alla fase successiva prima di quella conferma
5. Se l'utente chiede di verificare uno stato precedente e trovi
   un'incongruenza (es. l'ultimo commit non contiene quanto descritto
   in una risposta precedente), ammettilo direttamente: "il lavoro
   descritto non risulta committato, potrebbe essere stato scritto solo
   in locale o non scritto affatto" — non insistere che "dovrebbe
   esserci"

## Segnali che indicano una fase non ancora verificabile

- Un test che reimplementa la logica applicativa al proprio interno
  invece di importarla
- Un endpoint descritto ma mai mostrato per intero su richiesta
- Un numero di test o un nome di describe/it che cambia tra un
  riepilogo e l'altro per lo stesso file, senza una spiegazione
  esplicita del perché
