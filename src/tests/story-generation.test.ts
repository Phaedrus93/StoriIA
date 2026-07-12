import { describe, it, expect } from "vitest";
import {
  buildStoryPrompt,
  isDailyRateLimitExceeded,
  type AgeRange,
} from "../lib/ai/story-generator";

describe("Phase 4 — AI Story Generation Logic & Soft Rate Limiting Verification", () => {
  it("deve generare un prompt differenziato per fascia d'età 0-3 con tono nanna e onomatopee", () => {
    const prompt = buildStoryPrompt({
      ageRange: "0-3",
      characterName: "Leo",
      characterTraits: "Dolce e coccolone",
      settingName: "Prato fiorito",
      settingDescription: "Erba soffice e margherite",
      moralLessonTitle: "Condivisione",
      moralLessonDescription: "E bello dividere i giochi",
    });

    expect(prompt).toContain("0-3 ANNI");
    expect(prompt).toContain("onomatopee");
    expect(prompt).toContain("Leo");
  });

  it("deve generare un prompt articolato per fascia d'età 7-10 con vocabolario ricco e tre atti", () => {
    const prompt = buildStoryPrompt({
      ageRange: "7-10",
      characterName: "Aurora",
      characterTraits: "Esploratrice coraggiosa",
      settingName: "Stazione Spaziale",
      settingDescription: "Nello spazio profondo",
      moralLessonTitle: "Sincerità",
      moralLessonDescription: "Dire sempre la verità",
    });

    expect(prompt).toContain("7-10 ANNI");
    expect(prompt).toContain("trama articolata");
    expect(prompt).toContain("Aurora");
  });

  it("deve applicare correttamente il Soft Rate Limit di 20 storie al giorno", () => {
    expect(isDailyRateLimitExceeded(0)).toBe(false);
    expect(isDailyRateLimitExceeded(19)).toBe(false);
    expect(isDailyRateLimitExceeded(20)).toBe(true);
    expect(isDailyRateLimitExceeded(25)).toBe(true);
  });
});
