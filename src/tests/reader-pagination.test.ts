import { describe, it, expect } from "vitest";
import { paginateText } from "../lib/reader/paginator";

describe("Reader Pagination Engine (paginateText)", () => {
  it("deve raggruppare paragrafi brevi nella stessa pagina senza superare maxCharsPerPage", () => {
    const text = `Paragrafo uno corto.

Paragrafo due corto.

Paragrafo tre corto.`;

    const pages = paginateText(text, 100);
    expect(pages.length).toBe(1);
    expect(pages[0]).toContain("Paragrafo uno corto.");
    expect(pages[0]).toContain("Paragrafo tre corto.");
  });

  it("deve separare in più pagine quando la somma dei paragrafi supera maxCharsPerPage", () => {
    const p1 = "Questo è il primo paragrafo abbastanza lungo per occupare un po' di spazio.";
    const p2 = "Questo è il secondo paragrafo che farà superare il limite impostato per la pagina.";
    const text = `${p1}\n\n${p2}`;

    const pages = paginateText(text, 90);
    expect(pages.length).toBe(2);
    expect(pages[0]).toBe(p1);
    expect(pages[1]).toBe(p2);
  });

  it("deve applicare il fallback su fine-frase (. ! ?) quando un singolo paragrafo supera da solo maxCharsPerPage, senza spezzare parole", () => {
    const longParagraph =
      "Prima frase molto bella ed emozionante che racconta l'inizio di una grande avventura nel bosco incantato. " +
      "Seconda frase incredibile che aggiunge dettagli magici sulle fate luminose! " +
      "Terza frase con una domanda misteriosa su chi si nasconde dietro il grande albero antico?";

    // Impostiamo maxCharsPerPage = 130 per forzare la divisione all'interno del singolo paragrafo
    const pages = paginateText(longParagraph, 130);

    expect(pages.length).toBeGreaterThan(1);

    // Verifica che ogni pagina termini con un segno di punteggiatura di fine frase o parola intatta
    pages.forEach((page) => {
      expect(page.length).toBeLessThanOrEqual(130);

      // Verifica che nessuna parola sia spezzata a metà (nessuna parola tagliata senza spazi/punteggiatura)
      // Controlliamo che le parole presenti in ogni pagina esistano interamente nel paragrafo originale
      const wordsInPage = page.split(/\s+/);
      wordsInPage.forEach((w) => {
        const cleanWord = w.replace(/[.,!?]/g, "");
        if (cleanWord.length > 2) {
          expect(longParagraph).toContain(cleanWord);
        }
      });
    });

    // Verifica che la prima pagina si fermi al termine di una frase
    expect(pages[0].endsWith(".") || pages[0].endsWith("!") || pages[0].endsWith("?")).toBe(true);
  });

  it("deve applicare il fallback sul confine di parola se perfino una singola frase supera maxCharsPerPage, senza mai tagliare parole a metà", () => {
    const longSentence =
      "Questa è una singola lunghissima frase senza punti di sospensione o terminazioni che supera ampiamente il limite dei caratteri consentiti per una singola pagina.";

    const pages = paginateText(longSentence, 60);

    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((page) => {
      expect(page.length).toBeLessThanOrEqual(60);
    });

    // Ricostruzione delle parole per accertare che nessuna sia stata spezzata
    const reconstructedWords = pages.join(" ").split(/\s+/);
    const originalWords = longSentence.split(/\s+/);
    expect(reconstructedWords).toEqual(originalWords);
  });
});
