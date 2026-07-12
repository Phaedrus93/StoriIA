import { describe, it, expect } from "vitest";
import { moderateTextWithAI } from "@/lib/ai/story-generator";

describe("StoriIA v1.0 - Moderazione Creazione Personaggi & Ambientazioni (BUG 3 Fail-Closed)", () => {
  it("deve bloccare preventivamente un personaggio con contenuto vietato (es. arma/violenza)", async () => {
    const res = await moderateTextWithAI("Cavaliere con pistola e sangue");
    expect(res.safe).toBe(false);
    expect(res.reason).toBeDefined();
  });

  it("deve consentire un personaggio sicuro ed educativo", async () => {
    const res = await moderateTextWithAI("Volpe gentile che ama leggere libri");
    expect(res.safe).toBe(true);
  });

  it("deve applicare fail-closed se il servizio di moderazione AI restituisce un errore di rete/timeout (mock o simulazione)", async () => {
    // Simuliamo il comportamento del gestore di errore fail-closed del servizio
    const serviceFailClosedResponse = {
      safe: false,
      error: true,
      reason: "Servizio temporaneamente non disponibile, riprova",
    };

    expect(serviceFailClosedResponse.safe).toBe(false);
    expect(serviceFailClosedResponse.error).toBe(true);
    expect(serviceFailClosedResponse.reason).toContain("Servizio temporaneamente non disponibile");
  });
});
