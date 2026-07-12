import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { moderateTextWithAI } from "@/lib/ai/story-generator";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    if (user.app_metadata?.is_child_mode) {
      return NextResponse.json(
        { error: "Creazione personaggi consentita solo al genitore." },
        { status: 403 }
      );
    }

    const { name, traits, image_url } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Il nome del personaggio è obbligatorio." }, { status: 400 });
    }

    // 1. Recupero famiglia
    const { data: family, error: famErr } = await supabase
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json({ error: "Famiglia non trovata." }, { status: 404 });
    }

    // 2. Moderazione AI FAIL-CLOSED
    const textToCheck = `${name} ${traits || ""}`;
    const modResult = await moderateTextWithAI(textToCheck);

    const adminClient = createAdminClient();

    if (!modResult.safe) {
      const isServiceError = modResult.error === true;

      // Registrazione sicura con adminClient su moderation_flags
      await adminClient.from("moderation_flags").insert({
        family_id: family.id,
        stage: "input",
        result: isServiceError ? "retried" : "blocked",
      });

      return NextResponse.json(
        {
          error: modResult.reason || "Contenuto non idoneo.",
          moderationBlocked: !isServiceError,
          serviceError: isServiceError,
        },
        { status: isServiceError ? 503 : 400 }
      );
    }

    // 3. Inserimento personaggio
    const { data: newChar, error: insertErr } = await supabase
      .from("characters")
      .insert({
        family_id: family.id,
        name: name.trim(),
        traits: traits?.trim() || null,
        image_url: image_url || "/avatars/fox.svg",
        is_preset: false,
      })
      .select("*")
      .single();

    if (insertErr || !newChar) {
      return NextResponse.json(
        { error: `Errore creazione personaggio: ${insertErr?.message}` },
        { status: 500 }
      );
    }

    // Registra esito passed su moderation_flags
    await adminClient.from("moderation_flags").insert({
      family_id: family.id,
      character_id: newChar.id,
      stage: "input",
      result: "passed",
    });

    return NextResponse.json({ success: true, character: newChar });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore interno server";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
