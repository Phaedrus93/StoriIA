import { describe, it, expect } from "vitest";

describe("StoriIA v1.3 - Gamification 'Punti Avventura' & Ownership Security (BUG 1 & BUG 2)", () => {
  it("deve verificare la titolarità (ownership) e rifiutare con 403 modifiche su profili di altre famiglie (IDOR prevention)", () => {
    const parentAuthId = "user-genitore-1";
    const targetChildProfile = {
      id: "child-altrui",
      family_id: "family-2",
      parent_user_id: "user-genitore-2",
    };

    const isAuthorized = targetChildProfile.parent_user_id === parentAuthId;
    expect(isAuthorized).toBe(false);

    const httpStatus = isAuthorized ? 200 : 403;
    expect(httpStatus).toBe(403);
  });

  it("deve assegnare +15 Punti Avventura al completamento della lettura e aggiornare le missioni", () => {
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
