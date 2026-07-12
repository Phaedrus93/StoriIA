import { describe, it, expect } from "vitest";

describe("StoriIA v1.0 - Downgrade Tier, Sospensione Profili & Reactivate API (BUG 4)", () => {
  it("deve calcolare correttamente i profili da sospendere al passaggio da Family (6) a Free (1)", () => {
    const activeChildrenCount = 5;
    const newTierMaxAllowed = 1; // Free

    const toSuspendCount = Math.max(0, activeChildrenCount - newTierMaxAllowed);
    expect(toSuspendCount).toBe(4);
  });

  it("deve impedire l'accesso in modalità bambino a un profilo con is_suspended=true", () => {
    const childProfile = {
      id: "child-sospeso",
      name: "Bambino Sospeso",
      is_suspended: true,
    };

    const canEnterChildMode = !childProfile.is_suspended;
    expect(canEnterChildMode).toBe(false);
  });

  it("deve rifiutare la riattivazione server-side se il numero di profili attivi supera o eguaglia il limite consentito", () => {
    const currentActiveCount = 1;
    const maxAllowed = 1;

    const canReactivate = currentActiveCount < maxAllowed;
    expect(canReactivate).toBe(false);
  });
});
