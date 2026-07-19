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
        { error: "Creazione ambientazioni consentita solo al genitore." },
        { status: 403 }
      );
    }

    const { name, description, image_url } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Il nome dell'ambientazione è obbligatorio." }, { status: 400 });
    }
    if (name.trim().length > 50) {
      return NextResponse.json({ error: "Il nome dell'ambientazione supera il limite massimo di 50 caratteri." }, { status: 400 });
    }
    if (description && description.trim().length > 300) {
      return NextResponse.json({ error: "La descrizione dell'ambientazione supera il limite massimo di 300 caratteri." }, { status: 400 });
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
    const textToCheck = `${name} ${description || ""}`;
    const modResult = await moderateTextWithAI(textToCheck);

    const adminClient = createAdminClient();

    if (!modResult.safe) {
      const isServiceError = modResult.error === true;

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

    // 3. Inserimento ambientazione
    const { data: newSetting, error: insertErr } = await supabase
      .from("settings")
      .insert({
        family_id: family.id,
        name: name.trim(),
        description: description?.trim() || null,
        image_url: image_url || "/settings/forest.svg",
        is_preset: false,
      })
      .select("*")
      .single();

    if (insertErr || !newSetting) {
      return NextResponse.json(
        { error: `Errore creazione ambientazione: ${insertErr?.message}` },
        { status: 500 }
      );
    }

    await adminClient.from("moderation_flags").insert({
      family_id: family.id,
      setting_id: newSetting.id,
      stage: "input",
      result: "passed",
    });

    return NextResponse.json({ success: true, setting: newSetting });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore interno server";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
