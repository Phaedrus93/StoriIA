import { describe, it, expect } from "vitest";
import { hashPin, verifyPin, calculateLockoutStatus } from "../lib/security/pin";

describe("Parent PIN Security & Lockout Verification (9-test)", () => {
  it("deve generare un hash salato sicuro che non esponga mai il PIN in chiaro", async () => {
    const pin = "1234";
    const hashed = await hashPin(pin);

    expect(hashed).not.toBe(pin);
    expect(hashed).toContain(":"); // formato salt:hash
    expect(hashed.split(":")[0].length).toBe(32); // 16 bytes esadecimali
  });

  it("deve produrre hash diversi per lo stesso PIN grazie a salt causali univoci", async () => {
    const hash1 = await hashPin("5678");
    const hash2 = await hashPin("5678");

    expect(hash1).not.toBe(hash2);
  });

  it("deve verificare correttamente un PIN valido contro il proprio hash", async () => {
    const hashed = await hashPin("90123");
    const isValid = await verifyPin("90123", hashed);

    expect(isValid).toBe(true);
  });

  it("deve rifiutare un PIN errato contro un hash esistente", async () => {
    const hashed = await hashPin("1234");
    const isValid = await verifyPin("9999", hashed);

    expect(isValid).toBe(false);
  });

  it("deve rifiutare PIN malformati o al di fuori del range 4-6 cifre numeriche", async () => {
    await expect(hashPin("123")).rejects.toThrow(/4 a 6 cifre/i);
    await expect(hashPin("1234567")).rejects.toThrow(/4 a 6 cifre/i);
    await expect(hashPin("12AB")).rejects.toThrow(/4 a 6 cifre/i);
  });

  it("deve calcolare correttamente lo stato di blocco (Lockout) quando lockedUntil è nel futuro", () => {
    const futureDate = new Date(Date.now() + 15 * 60 * 1000); // +15 min
    const status = calculateLockoutStatus(5, futureDate);

    expect(status.isLocked).toBe(true);
    expect(status.remainingSeconds).toBeGreaterThan(800);
  });

  it("deve sbloccare automaticamente quando lockedUntil è nel passato", () => {
    const pastDate = new Date(Date.now() - 60 * 1000); // -1 min fa
    const status = calculateLockoutStatus(5, pastDate);

    expect(status.isLocked).toBe(false);
    expect(status.remainingSeconds).toBe(0);
  });
});
