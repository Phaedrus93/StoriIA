import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

const VALID_CATEGORIES = [
  "inappropriate_theme",
  "bad_language",
  "moral_inconsistency",
  "technical_defect",
  "other",
];

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    // Controllo blocco modalità bambino (da metadata JWT o cookie httpOnly)
    const cookieStore = await cookies();
    const isCookieChildMode = cookieStore.get("storiia_child_mode")?.value === "true";
    const isMetadataChildMode = user.app_metadata?.is_child_mode === true;

    if (isCookieChildMode || isMetadataChildMode) {
      return NextResponse.json(
        { error: "Accesso negato: operazione riservata all'area genitore." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { story_id, reason_category, details } = body;

    if (!story_id || typeof story_id !== "string") {
      return NextResponse.json({ error: "ID storia mancante o non valido." }, { status: 400 });
    }

    if (!reason_category || !VALID_CATEGORIES.includes(reason_category)) {
      return NextResponse.json(
        { error: `Categoria motivo non valida. Valori consentiti: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    // Recupero famiglia dell'utente autenticato
    const { data: family, error: famErr } = await supabase
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json({ error: "Famiglia non trovata per l'utente corrente." }, { status: 404 });
    }

    // Verifica esistenza della storia
    const { data: story, error: storyErr } = await supabase
      .from("stories")
      .select("id")
      .eq("id", story_id)
      .single();

    if (storyErr || !story) {
      return NextResponse.json({ error: "Storia specificata non trovata." }, { status: 404 });
    }

    // Inserimento della segnalazione in content_reports
    const { data: report, error: insertErr } = await supabase
      .from("content_reports")
      .insert({
        story_id: story_id,
        reported_by_family_id: family.id,
        reason_category: reason_category,
        details: details && typeof details === "string" ? details.trim().slice(0, 500) : null,
        status: "pending",
      })
      .select("*")
      .single();

    if (insertErr || !report) {
      return NextResponse.json(
        { error: `Errore durante il salvataggio della segnalazione: ${insertErr?.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore interno server";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
