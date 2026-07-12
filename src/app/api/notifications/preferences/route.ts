import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/notifications/preferences
 * Legge o inizializza le preferenze di notifica per la famiglia del genitore
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { data: family } = await supabase
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();

    if (!family) {
      return NextResponse.json({ error: "Famiglia non trovata" }, { status: 404 });
    }

    // Prova a leggere le preferenze
    let { data: prefs } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("family_id", family.id)
      .single();

    // Se non esistono, le creiamo con i default a true
    if (!prefs) {
      const { data: createdPrefs } = await supabase
        .from("notification_preferences")
        .insert({
          family_id: family.id,
          email_billing_alerts: true,
          email_activity_summary: true,
          email_low_credits: true,
        })
        .select("*")
        .single();
      prefs = createdPrefs;
    }

    return NextResponse.json({ preferences: prefs });
  } catch (err) {
    return NextResponse.json({ error: "Errore interno server" }, { status: 500 });
  }
}

/**
 * PUT /api/notifications/preferences
 * Aggiorna le preferenze di notifica
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { data: family } = await supabase
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();

    if (!family) {
      return NextResponse.json({ error: "Famiglia non trovata" }, { status: 404 });
    }

    const body = await request.json();
    const {
      email_billing_alerts,
      email_activity_summary,
      email_low_credits,
    } = body;

    const updatePayload: Record<string, boolean> = {};
    if (typeof email_billing_alerts === "boolean") updatePayload.email_billing_alerts = email_billing_alerts;
    if (typeof email_activity_summary === "boolean") updatePayload.email_activity_summary = email_activity_summary;
    if (typeof email_low_credits === "boolean") updatePayload.email_low_credits = email_low_credits;

    const { data: updated, error: updateError } = await supabase
      .from("notification_preferences")
      .upsert({
        family_id: family.id,
        ...updatePayload,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: "Errore aggiornamento preferenze" }, { status: 500 });
    }

    return NextResponse.json({ success: true, preferences: updated });
  } catch (err) {
    return NextResponse.json({ error: "Errore interno server" }, { status: 500 });
  }
}
