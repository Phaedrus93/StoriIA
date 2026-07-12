import { describe, it, expect } from "vitest";
import { moderateInputContent } from "../lib/ai/story-generator";

describe("StoriIA v1.1 - Moderazione AI e Tutela Minori", () => {
  it("deve approvare un input educativo e sicuro per bambini", () => {
    const check = moderateInputContent({
      ageRange: "4-6",
      characterName: "Volpetta LEO",
      characterTraits: "Gentile, curioso e coraggioso",
      settingName: "Bosco Incantato",
      settingDescription: "Un bosco pieno di alberi luminosi e scoiattoli",
      moralLessonTitle: "Amicizia",
      moralLessonDescription: "Aiutare gli altri rende tutti felici",
    });

    expect(check.safe).toBe(true);
    expect(check.reason).toBeUndefined();
  });

  it("deve bloccare preventivamente input contenenti parole violente o inappropriate", () => {
    const check = moderateInputContent({
      ageRange: "7-10",
      characterName: "Guerriero",
      characterTraits: "Vuole uccidere e spargere sangue nel regno",
      settingName: "Fortezza Oscura",
      settingDescription: "Un castello con armi e coltelli",
      moralLessonTitle: "Vendetta",
      moralLessonDescription: "Chi la fa l'aspetti",
    });

    expect(check.safe).toBe(false);
    expect(check.reason).toContain("Contenuto non adatto a minori");
  });

  it("deve bloccare riferimenti a sostanze o temi per adulti", () => {
    const check = moderateInputContent({
      ageRange: "4-6",
      characterName: "Personaggio",
      characterTraits: "Ama alcol e droga",
      settingName: "Città",
      settingDescription: "Strada",
      moralLessonTitle: "Nessuna",
      moralLessonDescription: "Nessuna",
    });

    expect(check.safe).toBe(false);
    expect(check.reason).toBeDefined();
  });
});
