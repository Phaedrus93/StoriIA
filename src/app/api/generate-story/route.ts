import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  isDailyRateLimitExceeded,
  generateStoryWithGemini,
  type AgeRange,
} from "@/lib/ai/story-generator";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();

    // 1. Verifica utente autenticato e non in modalità bambino
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    if (user.app_metadata?.is_child_mode) {
      return NextResponse.json(
        { error: "La generazione storie è riservata al genitore." },
        { status: 403 }
      );
    }

    // 2. Ottieni la famiglia del genitore
    const { data: family, error: famErr } = await supabase
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json(
        { error: "Famiglia non trovata per questo account." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const {
      ageRange,
      characterId,
      characterName,
      characterTraits,
      settingId,
      settingName,
      settingDescription,
      moralLessonTitle,
      moralLessonDescription,
      assignToChildIds,
    } = body;

    // 3. Controllo Soft Rate Limit (max 20 storie al giorno per famiglia)
    const today = new Date().toISOString().split("T")[0];
    const { count } = await supabase
      .from("stories")
      .select("*", { count: "exact", head: true })
      .eq("family_id", family.id)
      .gte("created_at", `${today}T00:00:00.000Z`);

    if (isDailyRateLimitExceeded(count || 0)) {
      return NextResponse.json(
        {
          error:
            "Hai raggiunto il limite giornaliero di 20 storie per la tua famiglia. Riprova domani!",
          rateLimitExceeded: true,
        },
        { status: 429 }
      );
    }

    // 4. Generazione del testo AI
    const generatedText = await generateStoryWithGemini({
      ageRange: (ageRange || "4-6") as AgeRange,
      characterName: characterName || "Protagonista",
      characterTraits: characterTraits || "Coraggioso e gentile",
      settingName: settingName || "Mondo Magico",
      settingDescription: settingDescription || "Un luogo fantastico",
      moralLessonTitle: moralLessonTitle || "Amicizia",
      moralLessonDescription:
        moralLessonDescription || "L'importanza di collaborare",
    });

    // 5. Salvataggio della storia nella tabella stories
    const { data: newStory, error: insertStoryErr } = await supabase
      .from("stories")
      .insert({
        family_id: family.id,
        character_id: characterId || null,
        setting_id: settingId || null,
        target_age_range: ageRange || "4-6",
        generated_text: generatedText,
      })
      .select("*")
      .single();

    if (insertStoryErr || !newStory) {
      return NextResponse.json(
        { error: "Errore durante il salvataggio della storia nel database." },
        { status: 500 }
      );
    }

    // 6. Assegnazione facoltativa alle storie dei profili figli specificati
    if (Array.isArray(assignToChildIds) && assignToChildIds.length > 0) {
      const assignments = assignToChildIds.map((childId: string) => ({
        story_id: newStory.id,
        child_profile_id: childId,
        reading_status: "new",
        last_read_position: 0,
      }));

      await supabase.from("story_assignments").insert(assignments);
    }

    return NextResponse.json({
      success: true,
      story: newStory,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Errore imprevisto server";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
