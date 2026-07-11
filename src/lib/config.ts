/**
 * StoriIA — Configurazione Centralizzata (MVP / Blocco 1)
 *
 * Tutte le configurazioni applicative non sensibili e costanti di sistema.
 * LE CHIAVI API (es. GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY) NON VANNO MAI ACCANTO
 * A QUESTO FILE: sono gestite solo via variabili d'ambiente in process.env.
 */

export const APP_CONFIG = {
  name: "StoriIA",
  version: "1.0.0-mvp",
  description: "Storie AI testuali personalizzate per bambini (lettura attiva)",

  // Fasce d'età supportate in generazione (come da PRD e Data Model MVP)
  targetAgeRanges: ["0-3", "4-6", "7-10"] as const,

  // Rate Limiting anti-abuso tecnico per la generazione AI
  generationLimit: {
    maxPerFamilyPer24Hours: 20,
  },

  // Configurazione Sicurezza e Uscita da Modalità Bambino
  childModeSecurity: {
    maxFailedPinAttempts: 5,
    lockoutDurationMinutes: 15,
  },

  // Modelli AI di Google AI Studio (Gemini)
  ai: {
    defaultModel: "gemini-2.5-flash",
    fallbackModel: "gemini-2.0-flash",
  },

  // Preset di Avatar Gratuiti di Default (MVP)
  defaultAvatarPresets: [
    {
      id: "avatar-exploratrice",
      name: "Esploratrice Stellare",
      image_url: "/avatars/explorer.svg",
      is_free: true,
    },
    {
      id: "avatar-cavaliere",
      name: "Piccolo Cavaliere",
      image_url: "/avatars/knight.svg",
      is_free: true,
    },
    {
      id: "avatar-volpe",
      name: "Volpe Saggia",
      image_url: "/avatars/fox.svg",
      is_free: true,
    },
    {
      id: "avatar-drago",
      name: "Draghetto Curioso",
      image_url: "/avatars/dragon.svg",
      is_free: true,
    },
    {
      id: "avatar-inventore",
      name: "Giovane Inventore",
      image_url: "/avatars/inventor.svg",
      is_free: true,
    },
    {
      id: "avatar-astronauta",
      name: "Astronauta Coraggioso",
      image_url: "/avatars/astronaut.svg",
      is_free: true,
    },
  ],

  // Morali predefinite di Default (MVP - tutte gratuite)
  defaultMoralLessons: [
    {
      id: "moral-condividere",
      label: "L'importanza di condividere con gli altri",
      is_free: true,
    },
    {
      id: "moral-coraggio",
      label: "Affrontare le piccole paure con coraggio",
      is_free: true,
    },
    {
      id: "moral-amicizia",
      label: "Il valore prezioso dell'amicizia e del rispetto",
      is_free: true,
    },
    {
      id: "moral-curiosita",
      label: "La curiosità e la voglia di imparare cose nuove",
      is_free: true,
    },
    {
      id: "moral-gentilezza",
      label: "Essere gentili ed aiutare chi si trova in difficoltà",
      is_free: true,
    },
    {
      id: "moral-onesta",
      label: "Dire sempre la verità ed essere sinceri",
      is_free: true,
    },
  ],
} as const;

export type TargetAgeRange = (typeof APP_CONFIG.targetAgeRanges)[number];
