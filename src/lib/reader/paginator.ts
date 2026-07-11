/**
 * Algoritmo di paginazione intelligente per la modalità lettura bambino.
 *
 * Priorità di spezzamento:
 * 1. Fine paragrafo (\n\n)
 * 2. Fine frase (. , ! , ?)
 * 3. Confine di parola (spazio), garantendo che nessuna parola venga mai spezzata a metà.
 */

export function paginateText(
  text: string,
  maxCharsPerPage: number = 450
): string[] {
  if (!text || !text.trim()) return [];

  // Rimuove eventuale titolo # iniziale se gestito separatamente o lo mantiene pulito
  const cleanText = text.trim();
  const paragraphs = cleanText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const pages: string[] = [];
  let currentPage = "";

  const pushPage = (content: string) => {
    const trimmed = content.trim();
    if (trimmed) pages.push(trimmed);
  };

  for (const paragraph of paragraphs) {
    // Se il paragrafo entra nella pagina corrente
    const potentialPage = currentPage
      ? `${currentPage}\n\n${paragraph}`
      : paragraph;

    if (potentialPage.length <= maxCharsPerPage) {
      currentPage = potentialPage;
      continue;
    }

    // Se la pagina corrente ha già contenuto, la salviamo e proviamo il paragrafo da solo
    if (currentPage) {
      pushPage(currentPage);
      currentPage = "";
    }

    // Se il paragrafo da solo entra in una pagina vuota
    if (paragraph.length <= maxCharsPerPage) {
      currentPage = paragraph;
      continue;
    }

    // Fallback 1: Il paragrafo supera da solo maxCharsPerPage -> dividiamo per frasi (. ! ?)
    const sentences = splitIntoSentences(paragraph);
    for (const sentence of sentences) {
      const candidatePage = currentPage
        ? `${currentPage} ${sentence}`
        : sentence;

      if (candidatePage.length <= maxCharsPerPage) {
        currentPage = candidatePage;
        continue;
      }

      if (currentPage) {
        pushPage(currentPage);
        currentPage = "";
      }

      // Se la singola frase entra in una pagina vuota
      if (sentence.length <= maxCharsPerPage) {
        currentPage = sentence;
        continue;
      }

      // Fallback 2: La singola frase supera maxCharsPerPage -> dividiamo per parole senza spezzare le parole
      const words = sentence.split(/\s+/).filter(Boolean);
      for (const word of words) {
        const candidateWordPage = currentPage
          ? `${currentPage} ${word}`
          : word;

        if (candidateWordPage.length <= maxCharsPerPage) {
          currentPage = candidateWordPage;
        } else {
          if (currentPage) {
            pushPage(currentPage);
          }
          currentPage = word;
        }
      }
    }
  }

  if (currentPage) {
    pushPage(currentPage);
  }

  return pages;
}

/**
 * Divide un testo in frasi preservando la punteggiatura finale (. ! ?).
 */
function splitIntoSentences(text: string): string[] {
  // Regex che individua sequenza terminata da . ! ? seguito da spazio o fine stringa
  const rawSentences = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g);
  if (!rawSentences) return [text];
  return rawSentences.map((s) => s.trim()).filter(Boolean);
}
