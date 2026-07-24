import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAdminPrivileges, createAdminClient } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { isAdmin, error } = await checkAdminPrivileges(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: error || "Non autorizzato" }, { status: 403 });
    }

    const adminClient = createAdminClient();

    const { data: reports, error: dbErr } = await adminClient
      .from("content_reports")
      .select("*, stories(id, generated_text, target_age_range), families(id, parent_user_id)")
      .order("created_at", { ascending: false });

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ reports: reports || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore recupero segnalazioni";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();
    const { isAdmin, error } = await checkAdminPrivileges(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: error || "Non autorizzato" }, { status: 403 });
    }

    const body = await req.json();
    const { id, status } = body;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "ID segnalazione obbligatorio" }, { status: 400 });
    }

    if (!status || !["pending", "reviewed", "dismissed"].includes(status)) {
      return NextResponse.json(
        { error: "Stato non valido. Valori ammessi: pending, reviewed, dismissed" },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: updatedReport, error: updateErr } = await adminClient
      .from("content_reports")
      .update({
        status: status,
        reviewed_at: status !== "pending" ? new Date().toISOString() : null,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: `Errore aggiornamento segnalazione: ${updateErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, report: updatedReport });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore aggiornamento stato segnalazione";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
