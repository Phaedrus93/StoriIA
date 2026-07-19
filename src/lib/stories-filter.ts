import { type UnifiedStory } from "@/components/stories/StoryCardUnified";
import { type StoryFilterState } from "@/components/stories/StoriesFilterBar";

/**
 * Funzione pura che filtra l'elenco unificato delle storie (AI + Preset)
 * rispecchiando esattamente le 4 regole formalizzate nel piano per la Fase 10:
 *
 * 1. Ricerca testuale, filtro fonte e fascia d'età sulla riga della storia (`stories`).
 * 2. Se `childFilter !== "all"` (singolo bambino), `statusFilter` valuta ESCLUSIVAMENTE
 *    la riga `story_assignments` di quel bambino specifico (`a.child_profile_id === childFilter`).
 * 3. Se `childFilter === "all"` e `statusFilter === "completed" | "in_progress" | "new"`,
 *    si adotta il criterio "Almeno un bambino" (`assignments.some(...)`).
 * 4. Se `childFilter === "all"` e `statusFilter === "unassigned"`, si verifica
 *    l'assenza totale di QUALUNQUE riga in `story_assignments` (`assignments.length === 0`).
 */
export function filterStories(
  stories: UnifiedStory[],
  filters: StoryFilterState
): UnifiedStory[] {
  return stories.filter((story) => {
    // 1. Ricerca testuale per titolo o parola chiave nel testo
    if (filters.searchQuery.trim() !== "") {
      const q = filters.searchQuery.toLowerCase().trim();
      const firstLine = story.generated_text.split("\n")[0] || "";
      const title = firstLine.replace(/^#\s*/, "").toLowerCase();
      const body = story.generated_text.toLowerCase();
      if (!title.includes(q) && !body.includes(q)) {
        return false;
      }
    }

    // 2. Filtro Fonte (`all` / `ai_generated` / `preset`)
    if (filters.sourceFilter !== "all") {
      const source = story.source || "ai_generated";
      if (filters.sourceFilter === "ai_generated" && source === "preset") {
        return false;
      }
      if (filters.sourceFilter === "preset" && source !== "preset") {
        return false;
      }
    }

    // 3. Filtro Fascia d'Età (`all` / `0-3` / `4-6` / `7-10`)
    if (filters.ageFilter !== "all") {
      if (story.target_age_range !== filters.ageFilter) {
        return false;
      }
    }

    // 4. Logica relazionale e criteri di assegnazione / stato di lettura
    const assignments = story.assignments || [];

    // CASO A: Bambino specifico selezionato (`childFilter !== "all"`)
    if (filters.childFilter !== "all") {
      if (filters.statusFilter === "all") {
        // La storia deve essere assegnata a questo bambino specifico (in qualsiasi stato)
        const isAssignedToChild = assignments.some(
          (a) => a.child_profile_id === filters.childFilter
        );
        if (!isAssignedToChild) return false;
      } else if (filters.statusFilter === "unassigned") {
        // La storia deve essere NON assegnata a questo bambino specifico
        const isAssignedToChild = assignments.some(
          (a) => a.child_profile_id === filters.childFilter
        );
        if (isAssignedToChild) return false;
      } else {
        // Lo stato deve corrispondere esattamente allo stato del bambino specifico
        const childMatch = assignments.some(
          (a) =>
            a.child_profile_id === filters.childFilter &&
            a.reading_status === filters.statusFilter
        );
        if (!childMatch) return false;
      }
    }
    // CASO B: "Tutti i bambini" (`childFilter === "all"`)
    else {
      if (filters.statusFilter === "unassigned") {
        // Assenza di QUALUNQUE riga in story_assignments per questa storia
        if (assignments.length > 0) return false;
      } else if (filters.statusFilter !== "all") {
        // Criterio "Almeno un bambino" (`some`) per completed / in_progress / new
        const hasStatusMatch = assignments.some(
          (a) => a.reading_status === filters.statusFilter
        );
        if (!hasStatusMatch) return false;
      }
    }

    return true;
  });
}
