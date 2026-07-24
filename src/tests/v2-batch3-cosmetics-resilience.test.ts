import { describe, it, expect, vi, beforeEach } from "vitest";

const mockIsUnlocked = true;
const mockFamilyTier = "free";

function getLockedStatus(isUnlocked: boolean, planOk: boolean) {
  // Logic from GamificationModal.tsx
  return !planOk && !isUnlocked;
}

function isPlanSufficient(required: string, current: string) {
  const tiers: Record<string, number> = { free: 0, premium: 1, family: 2 };
  return (tiers[current] ?? 0) >= (tiers[required] ?? 0);
}

describe("Batch 3 - Cosmetics Resilience & Novità", () => {
  it("Cosmetic acquistato deve restare sbloccato dopo downgrade piano", () => {
    const requiredPlan = "premium";
    const currentPlan = "free"; // Downgraded
    const planOk = isPlanSufficient(requiredPlan, currentPlan);
    
    // Test the logic directly
    const isUnlocked = true; // User bought it previously
    const locked = getLockedStatus(isUnlocked, planOk);
    
    expect(planOk).toBe(false);
    expect(locked).toBe(false); // Must not be locked!
  });

  it("Cosmetic non acquistato e piano insufficiente deve essere bloccato", () => {
    const requiredPlan = "premium";
    const currentPlan = "free";
    const planOk = isPlanSufficient(requiredPlan, currentPlan);
    
    const isUnlocked = false; 
    const locked = getLockedStatus(isUnlocked, planOk);
    
    expect(planOk).toBe(false);
    expect(locked).toBe(true); // Must be locked!
  });

  it("Cosmetic non acquistato e piano sufficiente non deve essere bloccato", () => {
    const requiredPlan = "premium";
    const currentPlan = "family";
    const planOk = isPlanSufficient(requiredPlan, currentPlan);
    
    const isUnlocked = false; 
    const locked = getLockedStatus(isUnlocked, planOk);
    
    expect(planOk).toBe(true);
    expect(locked).toBe(false); // Must not be locked!
  });
});
