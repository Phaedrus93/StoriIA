import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/notifications
 * Restituisce le notifiche della famiglia autenticata e il numero di non lette.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { data: family, error: famError } = await supabase
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();

    if (famError || !family) {
      return NextResponse.json({ error: "Famiglia non trovata" }, { status: 404 });
    }

    // Lettura delle notifiche (ultime 50 per prestazione UI)
    const { data: notifications, error: notifError } = await supabase
      .from("notifications")
      .select("*")
      .eq("family_id", family.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (notifError) {
      return NextResponse.json({ error: "Errore lettura notifiche" }, { status: 500 });
    }

    const unreadCount = (notifications || []).filter((n) => !n.is_read).length;

    return NextResponse.json({
      notifications: notifications || [],
      unreadCount,
    });
  } catch (err) {
    return NextResponse.json({ error: "Errore interno server" }, { status: 500 });
  }
}

/**
 * PUT /api/notifications
 * Permette di segnare una notifica come letta (notificationId) o tutte (action: "mark_all_read")
 */
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { data: family, error: famError } = await supabase
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();

    if (famError || !family) {
      return NextResponse.json({ error: "Famiglia non trovata" }, { status: 404 });
    }

    const body = await request.json();
    const { notificationId, action } = body;

    if (action === "mark_all_read") {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("family_id", family.id)
        .eq("is_read", false);

      if (error) {
        return NextResponse.json({ error: "Errore aggiornamento notifiche" }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (!notificationId) {
      return NextResponse.json({ error: "notificationId mancante" }, { status: 400 });
    }

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("family_id", family.id);

    if (error) {
      return NextResponse.json({ error: "Errore aggiornamento notifica" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Errore interno server" }, { status: 500 });
  }
}

/**
 * DELETE /api/notifications
 * Permette di eliminare una singola notifica o tutte le notifiche lette
 */
export async function DELETE(request: Request) {
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
    const { notificationId, action } = body;

    if (action === "clear_read") {
      await supabase
        .from("notifications")
        .delete()
        .eq("family_id", family.id)
        .eq("is_read", true);
      return NextResponse.json({ success: true });
    }

    if (notificationId) {
      await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId)
        .eq("family_id", family.id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Errore interno server" }, { status: 500 });
  }
}
