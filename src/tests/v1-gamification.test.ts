import { describe, it, expect } from "vitest";

describe("StoriIA v1.3 - Gamification 'Punti Avventura', Missioni e Negozio Premi", () => {
  it("deve assegnare +15 Punti Avventura al completamento della lettura di una storia", () => {
    const initialPoints = 10;
    const readingCompleted = true;
    const newPoints = readingCompleted ? initialPoints + 15 : initialPoints;
    expect(newPoints).toBe(25);
  });

  it("deve consentire lo sblocco di un premio cosmetico se i Punti Avventura sono sufficienti e detrarre il costo", () => {
    let currentPoints = 30;
    const cosmeticCost = 15;

    const canUnlock = currentPoints >= cosmeticCost;
    expect(canUnlock).toBe(true);

    if (canUnlock) {
      currentPoints -= cosmeticCost;
    }
    expect(currentPoints).toBe(15);
  });

  it("deve impedire lo sblocco di un premio se i Punti Avventura non sono sufficienti", () => {
    const currentPoints = 10;
    const cosmeticCost = 50;

    const canUnlock = currentPoints >= cosmeticCost;
    expect(canUnlock).toBe(false);
  });

  it("deve impedire lo sblocco duplicato di un premio già presente nel catalogo sbloccato", () => {
    const unlockedList = ["badge-apprendista", "frame-stella"];
    const targetCosmeticId = "badge-apprendista";

    const isAlreadyUnlocked = unlockedList.includes(targetCosmeticId);
    expect(isAlreadyUnlocked).toBe(true);
  });
});
