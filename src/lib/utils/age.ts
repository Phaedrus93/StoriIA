import type { AgeRange } from "@/lib/ai/story-generator";

/**
 * Calcola l'età in anni completi a partire dall'anno di nascita rispetto a una data di riferimento.
 */
export function calculateAgeFromBirthYear(birthYear: number, referenceDate: Date = new Date()): number {
  const currentYear = referenceDate.getFullYear();
  const age = currentYear - birthYear;
  return age < 0 ? 0 : age;
}

/**
 * Calcola la fascia d'età suggerita ("0-3" | "4-6" | "7-10") a partire dall'anno di nascita.
 */
export function calculateAgeRangeFromBirthYear(birthYear: number, referenceDate: Date = new Date()): AgeRange {
  const age = calculateAgeFromBirthYear(birthYear, referenceDate);
  if (age <= 3) {
    return "0-3";
  } else if (age <= 6) {
    return "4-6";
  } else {
    return "7-10";
  }
}
