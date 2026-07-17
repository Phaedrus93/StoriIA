import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAdminPrivileges, createAdminClient } from "@/lib/admin";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { isAdmin, error } = await checkAdminPrivileges(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: error || "Non autorizzato" }, { status: 403 });
    }

    const url = new URL(req.url);
    const type = url.searchParams.get("type");

    if (type === "reading_quests") {
      const { data, error: dbErr } = await supabase.from("reading_quests").select("*").order("required_count", { ascending: true });
      if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
      return NextResponse.json({ reading_quests: data || [] });
    }

    if (type === "cosmetic_items") {
      const { data, error: dbErr } = await supabase.from("cosmetic_items").select("*").order("cost_points", { ascending: true });
      if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
      return NextResponse.json({ cosmetic_items: data || [] });
    }

    const { data: quests } = await supabase.from("reading_quests").select("*").order("required_count", { ascending: true });
    const { data: cosmetics } = await supabase.from("cosmetic_items").select("*").order("cost_points", { ascending: true });

    return NextResponse.json({
      reading_quests: quests || [],
      cosmetic_items: cosmetics || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore recupero gamification";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { isAdmin, error } = await checkAdminPrivileges(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: error || "Non autorizzato" }, { status: 403 });
    }

    const body = await req.json();
    const table = body.table || body.type;
    if (!["reading_quests", "cosmetic_items"].includes(table)) {
      return NextResponse.json({ error: "Tabella gamification non valida (`reading_quests` o `cosmetic_items`)" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const payload = { ...body };
    delete payload.table;
    delete payload.type;

    const { data, error: dbErr } = await adminClient
      .from(table)
      .insert(payload)
      .select()
      .single();

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore creazione elemento gamification";
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
    const table = body.table || body.type;
    if (!["reading_quests", "cosmetic_items"].includes(table) || !body.id) {
      return NextResponse.json({ error: "Tabella gamification o id non valido" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const payload = { ...body };
    const id = payload.id;
    delete payload.id;
    delete payload.table;
    delete payload.type;

    const { data, error: dbErr } = await adminClient
      .from(table)
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore aggiornamento elemento gamification";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { isAdmin, error } = await checkAdminPrivileges(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: error || "Non autorizzato" }, { status: 403 });
    }

    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const table = url.searchParams.get("table") || url.searchParams.get("type");

    if (!id || !table || !["reading_quests", "cosmetic_items"].includes(table)) {
      return NextResponse.json({ error: "Parametri id e table (`reading_quests` o `cosmetic_items`) richiesti" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error: dbErr } = await adminClient
      .from(table)
      .delete()
      .eq("id", id);

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore eliminazione elemento gamification";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
