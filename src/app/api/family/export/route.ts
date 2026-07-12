import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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
        { error: "L'esportazione dati è riservata al genitore." },
        { status: 403 }
      );
    }

    const { data: family, error: famErr } = await supabase
      .from("families")
      .select("*")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json(
        { error: "Famiglia non trovata" },
        { status: 404 }
      );
    }

    const [
      { data: children },
      { data: characters },
      { data: settings },
      { data: stories },
      { data: auditLogs },
    ] = await Promise.all([
      supabase.from("child_profiles").select("*").eq("family_id", family.id),
      supabase.from("characters").select("*").eq("family_id", family.id),
      supabase.from("settings").select("*").eq("family_id", family.id),
      supabase.from("stories").select("*").eq("family_id", family.id),
      supabase
        .from("generation_audit_logs")
        .select("*")
        .eq("family_id", family.id),
    ]);

    const exportPayload = {
      exportDate: new Date().toISOString(),
      family,
      childProfiles: children || [],
      characters: characters || [],
      settings: settings || [],
      stories: stories || [],
      generationAuditLogs: auditLogs || [],
    };

    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="storiia_export_famiglia_${family.id}.json"`,
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Errore durante export GDPR";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
