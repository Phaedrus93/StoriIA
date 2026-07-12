import crypto from "crypto";

const KEY_LENGTH = 64;

// Parametri di costo OWASP per scrypt (memory-hard KDF):
// N (cost): 16384 (2^14) - costo CPU/memoria
// r (blockSize): 8 - dimensione blocco
// p (parallelization): 5 - fattore di parallelizzazione OWASP raccomandato
const SCRYPT_OPTIONS = {
  cost: 16384,
  blockSize: 8,
  parallelization: 5,
  maxmem: 32 * 1024 * 1024, // 32 MB di limite memoria
};

/**
 * Genera un hash salato sicuro per il PIN numerico del genitore
 * Formato output: `${saltHex}:${derivedKeyHex}`
 */
export async function hashPin(pin: string): Promise<string> {
  if (!pin || !/^\d{4,6}$/.test(pin)) {
    throw new Error("Il PIN deve essere composto da 4 a 6 cifre numeriche.");
  }

  const salt = crypto.randomBytes(16).toString("hex");

  return new Promise((resolve, reject) => {
    crypto.scrypt(pin, salt, KEY_LENGTH, SCRYPT_OPTIONS, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

/**
 * Verifica un PIN rispetto a un hash salato memorizzato
 * Utilizza confronto a tempo costante (timingSafeEqual) contro attacchi temporali
 */
export async function verifyPin(
  pin: string,
  storedHash: string | null | undefined
): Promise<boolean> {
  if (!pin || !storedHash || !storedHash.includes(":")) {
    return false;
  }

  const [salt, hashHex] = storedHash.split(":");
  if (!salt || !hashHex) return false;

  const storedKeyBuffer = Buffer.from(hashHex, "hex");

  return new Promise((resolve, reject) => {
    crypto.scrypt(
      pin,
      salt,
      storedKeyBuffer.length,
      SCRYPT_OPTIONS,
      (err, derivedKey) => {
        if (err) return reject(err);

        // Confronto sicuro contro attacchi side-channel basati sul tempo
        try {
          const isMatch = crypto.timingSafeEqual(storedKeyBuffer, derivedKey);
          resolve(isMatch);
        } catch {
          resolve(false);
        }
      }
    );
  });
}

/**
 * Calcola lo stato di blocco (Lockout) anti brute-force
 * Aggiorna il tempo di blocco a 15 minuti dopo 5 tentativi falliti
 */
export function calculateLockoutStatus(
  failedAttempts: number,
  lockedUntil: Date | string | null
): {
  isLocked: boolean;
  remainingSeconds: number;
} {
  if (!lockedUntil) {
    return { isLocked: false, remainingSeconds: 0 };
  }

  const lockDate = typeof lockedUntil === "string" ? new Date(lockedUntil) : lockedUntil;
  const now = new Date();
  const diffSeconds = Math.ceil((lockDate.getTime() - now.getTime()) / 1000);

  if (diffSeconds > 0) {
    return { isLocked: true, remainingSeconds: diffSeconds };
  }

  return { isLocked: false, remainingSeconds: 0 };
}

export const hashParentPin = hashPin;
export const verifyParentPin = verifyPin;
