"use server";

import { hashPin } from "@/lib/security/pin";

/**
 * Server Action Next.js per calcolare l'hash scrypt OWASP del PIN
 * lato server Node.js, evitando limitazioni dei bundle browserify client.
 */
export async function hashPinAction(pin: string): Promise<string> {
  return await hashPin(pin);
}
