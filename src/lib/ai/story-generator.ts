import { GoogleGenAI } from "@google/genai";

export type AgeRange = "0-3" | "4-6" | "7-10";

export interface GenerateStoryInput {
  ageRange: AgeRange;
  characterName: string;
  characterTraits: string;
  settingName: string;
  settingDescription: string;
  moralLessonTitle: string;
  moralLessonDescription: string;
  preciseAge?: number;
}

/**
 * Verifica se la famiglia ha superato il limite soft di 20 storie generate nella giornata odierna
 */
export function isDailyRateLimitExceeded(dailyCount: number): boolean {
  return dailyCount >= 20;
}

/**
 * Costruisce il prompt strutturato per Gemini AI modulato sulla specifica fascia d'età del bambino
 */
export function buildStoryPrompt(input: GenerateStoryInput): string {
  const ageSpecificInstructions: Record<AgeRange, string> = {
    "0-3": `
- STILE E TONO: Dolcissimo, rassicurante, molto ritmato e musicale.
- LINGUAGGIO: Frasi brevissime, semplici e ripetitive. Usa onomatopee delicate (es. "din-don", "tic-tac", versi di animaletti gentili).
- TRAMA: Niente paure o tensioni. Una passeggiata tranquilla o una piccola scoperta che termina con un finale rilassante da nanna.`,
    "4-6": `
- STILE E TONO: Fiabesco, vivace ed esplorativo.
- LINGUAGGIO: Vocabolario chiaro e immaginifico, con brevi dialoghi amichevoli.
- TRAMA: Un piccolo mistero o sfida da risolvere con ingegno e aiuto reciproco. Metti bene in risalto la morale positiva.`,
    "7-10": `
- STILE E TONO: Avventuroso, coinvolgente, con una trama articolata in tre atti (inizio, sviluppo, conclusione).
- LINGUAGGIO: Vocabolario ricco e descrittivo, dialoghi espressivi e stimolanti per la fantasia.
- TRAMA: Il personaggio affronta una sfida significativa in cui deve dimostrare coraggio o lealtà, integrando la morale in modo naturale.`,
  };

  const preciseAgeInstruction = typeof input.preciseAge === "number"
    ? `\n- Età esatta del bambino destinatario: ${input.preciseAge} anni. Calibra il vocabolario, la lunghezza delle frasi e la complessità specificamente per un bambino di esattamente ${input.preciseAge} anni (all'interno della fascia ${input.ageRange}).`
    : "";

  return `Sei un autore esperto e premuroso di storie per bambini in lingua italiana.
Scrivi una storia originale e adatta all'età del bambino basandoti sulle seguenti istruzioni:

=== DETTAGLI PROTAGONISTA ===
- Nome: ${input.characterName}
- Tratti e caratteristiche: ${input.characterTraits}

=== AMBIENTAZIONE ===
- Luogo: ${input.settingName}
- Atmosfera: ${input.settingDescription}

=== MORALE / LEZIONE EDUCATIVA ===
- Tema principale: ${input.moralLessonTitle}
- Dettaglio morale: ${input.moralLessonDescription}

=== INDICAZIONI SPECIFICHE PER FASCIA D'ETÀ (${input.ageRange} ANNI) ===
${ageSpecificInstructions[input.ageRange]}${preciseAgeInstruction}

REGOLE ESSENZIALI:
1. La storia DEVE essere scritta interamente in italiano corretto ed espressivo.
2. Formatta la storia in paragrafi leggibili.
3. Includi un titolo accattivante nella prima riga formato come "# Titolo della Storia".`;
}

/**
 * Moderazione preventiva del testo in input (tutela minori - violenza, armi, contenuti sessuali, odio)
 */
export function moderateInputContent(input: GenerateStoryInput): { safe: boolean; reason?: string } {
  const combinedText = `${input.characterName} ${input.characterTraits} ${input.settingName} ${input.settingDescription}`.toLowerCase();

  const blockedKeywords = [
    "arma",
    "armi",
    "coltello",
    "pistola",
    "sangue",
    "uccidere",
    "morte violenta",
    "droga",
    "alcol",
    "sesso",
    "sessuale",
    "suicidio",
    "odio",
    "tortura",
  ];

  for (const word of blockedKeywords) {
    if (combinedText.includes(word)) {
      return {
        safe: false,
        reason: `Contenuto non adatto a minori rilevato nel prompt (${word})`,
      };
    }
  }

  return { safe: true };
}

/**
 * Moderazione del testo via AI (approccio FAIL-CLOSED)
 * Utilizza Google Gemini / Safety check prima della creazione di personaggi e ambientazioni.
 * In caso di errore di rete/servizio/quota, adotta il fail-closed per non autorizzare contenuti non verificati.
 */
export async function moderateTextWithAI(text: string): Promise<{
  safe: boolean;
  reason?: string;
  error?: boolean;
}> {
  // 1. Controllo di primo livello (veloce e locale)
  const localCheck = moderateInputContent({
    ageRange: "4-6",
    characterName: text,
    characterTraits: "",
    settingName: "",
    settingDescription: "",
    moralLessonTitle: "",
    moralLessonDescription: "",
  });

  if (!localCheck.safe) {
    return { safe: false, reason: localCheck.reason };
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "placeholder-gemini-key") {
    // In ambiente offline di test senza chiave reale, si affida alla verifica locale già superata
    return { safe: true };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Analizza il seguente testo destinato a una favola per bambini (personaggio o ambientazione) e rispondi SOLO con la parola "SAFE" se è completamente sicuro ed educativo per un pubblico sotto i 10 anni, oppure "UNSAFE" se contiene o allude a violenza, odio, armi, sangue, molestie, temi per adulti o contenuti inappropriati:\n\nTesto: "${text}"`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const outText = (response.text || "").trim().toUpperCase();
    if (outText.includes("UNSAFE")) {
      return {
        safe: false,
        reason: "Il contenuto non è idoneo per le storie per bambini secondo i filtri di sicurezza.",
      };
    }
    return { safe: true };
  } catch (err) {
    // REGOLA FAIL-CLOSED: se il servizio AI fallisce per errore di rete, timeout o quota, blocca con errore di servizio
    console.error("[moderateTextWithAI] Errore servizio di moderazione:", err);
    return {
      safe: false,
      error: true,
      reason: "Servizio temporaneamente non disponibile, riprova",
    };
  }
}


/**
 * Invoca Google Gemini API (gemini-2.5-flash) con controllo di moderazione preventiva e retry automatico (max 1)
 */
export async function generateStoryWithGemini(input: GenerateStoryInput): Promise<string> {
  const modCheck = moderateInputContent(input);
  if (!modCheck.safe) {
    throw new Error(`MODERATION_BLOCKED: ${modCheck.reason}`);
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // Se l'API key non è configurata (es. test offline o ambiente dev iniziale), restituiamo una storia mockata realistica
  if (!apiKey || apiKey === "placeholder-gemini-key") {
    return `# La Grande Avventura di ${input.characterName} a ${input.settingName}

C'era una volta ${input.characterName}, che si distingue per essere ${input.characterTraits.toLowerCase()}. Un giorno di sole decise di esplorare ${input.settingName}, un luogo magico dove ${input.settingDescription.toLowerCase()}.

Mentre camminava, si trovò di fronte a un piccolo ostacolo. Fu allora che ricordò quanto fosse importante: ${input.moralLessonTitle}.

Con un grande sorriso e tanta gentilezza, riuscì a superare la sfida e capì che ${input.moralLessonDescription.toLowerCase()}. E così tornarono tutti felici e contenti.`;
  }

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildStoryPrompt(input);

  // Tentativo di generazione con 1 retry automatico gratuito in caso di fallimento o blocco transitorio
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const text = response.text;
      if (!text) {
        throw new Error("Risposta vuota dall'API Gemini.");
      }
      return text;
    } catch (err: unknown) {
      if (attempt === 2) {
        const message = err instanceof Error ? err.message : "Errore durante la generazione AI";
        if (message.includes("SAFETY") || message.includes("blocked")) {
          throw new Error(`MODERATION_BLOCKED: Contenuto bloccato dai filtri di sicurezza di Gemini AI (${message})`);
        }
        throw new Error(`Errore di generazione storia AI: ${message}`);
      }
    }
  }

  throw new Error("Errore imprevisto durante il retry di generazione AI");
}
