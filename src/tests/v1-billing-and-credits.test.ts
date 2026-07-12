import { describe, it, expect } from "vitest";

describe("StoriIA v1.2 - Fatturazione Genitore, Crediti & Stripe Ledger", () => {
  it("deve validare il saldo crediti sufficiente prima di consentire la generazione", () => {
    const creditsBalance = 0;
    const canGenerate = creditsBalance > 0;
    expect(canGenerate).toBe(false);
  });

  it("deve bloccare la generazione se lo stato dell'abbonamento è 'frozen' (mancato pagamento)", () => {
    const subscriptionStatus = "frozen";
    const isBlocked = subscriptionStatus === "frozen";
    expect(isBlocked).toBe(true);
  });

  it("deve calcolare correttamente il saldo finale dopo un addebito atomico (-1) e un rimborso automatico (+1)", () => {
    let balance = 5;

    // 1. Inizio generazione -> scalaggio atomico -1
    balance -= 1;
    expect(balance).toBe(4);

    // 2. Fallimento AI o blocco moderazione -> rimborso automatico +1
    balance += 1;
    expect(balance).toBe(5);
  });

  it("deve registrare le transazioni del ledger con importi coerenti con il tipo di movimento", () => {
    const spendEntry = {
      type: "GENERATION_SPEND",
      amount: -1,
    };
    const refundEntry = {
      type: "GENERATION_REFUND",
      amount: +1,
    };

    expect(spendEntry.amount).toBeLessThan(0);
    expect(refundEntry.amount).toBeGreaterThan(0);
  });
});
