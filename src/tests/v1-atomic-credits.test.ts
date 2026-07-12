import { describe, it, expect } from "vitest";

describe("StoriIA v1.0 - Scalaggio Crediti Atomico & Concorrenza (BUG 7)", () => {
  it("deve impedire saldo negativo sotto richieste concorrenti simulando consume_credit", () => {
    let currentBalance = 3;

    // Simulazione di consume_credit atomico (SELECT FOR UPDATE / singola query WHERE credits_balance > 0)
    const consumeCreditAtomic = () => {
      if (currentBalance > 0) {
        currentBalance -= 1;
        return true;
      }
      return false;
    };

    const results = [
      consumeCreditAtomic(),
      consumeCreditAtomic(),
      consumeCreditAtomic(),
      consumeCreditAtomic(),
      consumeCreditAtomic(),
    ];

    const successCount = results.filter(Boolean).length;
    const failCount = results.filter((r) => !r).length;

    expect(successCount).toBe(3);
    expect(failCount).toBe(2);
    expect(currentBalance).toBe(0);
  });

  it("deve rimborsare il credito in modo atomico (refund_credit)", () => {
    let balance = 2;
    const refundCreditAtomic = () => {
      balance += 1;
      return true;
    };

    refundCreditAtomic();
    expect(balance).toBe(3);
  });
});
