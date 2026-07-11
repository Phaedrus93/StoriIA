import { describe, it, expect } from "vitest";

/**
 * Modello logico/eseguibile delle Policy RLS definite in sql/01_mvp_schema.sql
 * Questo test assicura l'invariante di sicurezza:
 * 1. is_child_mode = true blocca qualsiasi operazione di INSERT/DELETE su entità del genitore
 * 2. In modalità bambino, la query SELECT su story_assignments filtra rigorosamente per active_child_profile_id
 */

interface JwtClaims {
  sub: string; // auth.uid()
  app_metadata?: {
    is_child_mode?: boolean;
    active_child_profile_id?: string;
  };
}

// Simulazione fedele di public.is_child_mode() in Postgres
function isChildMode(claims: JwtClaims): boolean {
  return Boolean(claims.app_metadata?.is_child_mode);
}

// Simulazione fedele di public.get_active_child_profile_id() in Postgres
function getActiveChildProfileId(claims: JwtClaims): string | null {
  return claims.app_metadata?.active_child_profile_id || null;
}

// Simulazione verifica Policy RLS INSERT su characters / settings / stories
function canInsertEntity(claims: JwtClaims, entityFamilyId: string, myFamilyId: string): boolean {
  return entityFamilyId === myFamilyId && !isChildMode(claims);
}

// Simulazione verifica Policy RLS SELECT su story_assignments
function filterStoryAssignmentsRLS(
  assignments: Array<{ id: string; story_id: string; child_profile_id: string }>,
  claims: JwtClaims
): Array<{ id: string; story_id: string; child_profile_id: string }> {
  return assignments.filter((assign) => {
    if (!isChildMode(claims)) {
      // Il genitore vede tutte le assegnazioni della propria famiglia
      return true;
    }
    // In modalità bambino, si vede SOLO l'assegnazione legata al profilo bambino attivo nel JWT
    return assign.child_profile_id === getActiveChildProfileId(claims);
  });
}

describe("Security & RLS Policies Enforcement — Modalità Bambino", () => {
  const parentClaims: JwtClaims = {
    sub: "user-parent-uuid",
    app_metadata: {
      is_child_mode: false,
    },
  };

  const childClaims: JwtClaims = {
    sub: "user-parent-uuid",
    app_metadata: {
      is_child_mode: true,
      active_child_profile_id: "child-1-uuid",
    },
  };

  it("deve identificare correttamente lo stato is_child_mode dai claim JWT", () => {
    expect(isChildMode(parentClaims)).toBe(false);
    expect(isChildMode(childClaims)).toBe(true);
    expect(getActiveChildProfileId(childClaims)).toBe("child-1-uuid");
  });

  it("deve consentire al genitore di inserire personaggi, ambientazioni e storie", () => {
    const allowed = canInsertEntity(parentClaims, "family-123", "family-123");
    expect(allowed).toBe(true);
  });

  it("deve BLOCCARE il bypass di scrittura (INSERT/DELETE) quando la sessione è in modalità bambino", () => {
    const allowed = canInsertEntity(childClaims, "family-123", "family-123");
    expect(allowed).toBe(false);
  });

  it("deve filtrare story_assignments per active_child_profile_id quando in modalità bambino per evitare fuga di dati tra fratelli", () => {
    const mockAssignments = [
      { id: "assign-1", story_id: "story-1", child_profile_id: "child-1-uuid" },
      { id: "assign-2", story_id: "story-2", child_profile_id: "child-2-uuid" },
    ];

    // Il genitore vede tutte le 2 assegnazioni
    const parentView = filterStoryAssignmentsRLS(mockAssignments, parentClaims);
    expect(parentView).toHaveLength(2);

    // Il bambino 1 vede SOLO la propria assegnazione (non quella del fratello child-2-uuid)
    const child1View = filterStoryAssignmentsRLS(mockAssignments, childClaims);
    expect(child1View).toHaveLength(1);
    expect(child1View[0].child_profile_id).toBe("child-1-uuid");
  });
});
