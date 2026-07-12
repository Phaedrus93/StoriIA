export interface PreDeleteCheckResult {
  requiresExplicitConfirmation: boolean;
  storyCount: number;
}

/**
 * Valuta la decisione applicativa sulla visualizzazione della modale di conferma consapevole
 * prima dell'eliminazione di un'entità della libreria (personaggio o ambientazione).
 */
export function evaluatePreDeleteCheck(storyCount: number): PreDeleteCheckResult {
  const count = Math.max(0, storyCount);
  if (count > 0) {
    return {
      requiresExplicitConfirmation: true,
      storyCount: count,
    };
  }
  return {
    requiresExplicitConfirmation: false,
    storyCount: 0,
  };
}
