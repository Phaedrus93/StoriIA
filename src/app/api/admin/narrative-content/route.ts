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

    const { data, error: dbErr } = await supabase
      .from("narrative_content_catalog")
      .select("*")
      .order("content_type", { ascending: true })
      .order("created_at", { ascending: false });

    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    return NextResponse.json({ narrative_content: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore recupero contenuti narrativi";
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
    const adminClient = createAdminClient();

    const { data, error: dbErr } = await adminClient
      .from("narrative_content_catalog")
      .insert(body)
      .select()
      .single();

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore creazione contenuto narrativo";
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
    if (!body.id) {
      return NextResponse.json({ error: "Id mancante" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const id = body.id;
    const payload = { ...body };
    delete payload.id;

    const { data, error: dbErr } = await adminClient
      .from("narrative_content_catalog")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, item: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore aggiornamento contenuto narrativo";
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

    if (!id) {
      return NextResponse.json({ error: "Id mancante" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error: dbErr } = await adminClient
      .from("narrative_content_catalog")
      .delete()
      .eq("id", id);

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore eliminazione contenuto narrativo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
