import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAdminPrivileges, createAdminClient } from "@/lib/admin";

export async function GET() {
  try {
    const supabase = await createClient();
    const { isAdmin, error } = await checkAdminPrivileges(supabase);

    if (!isAdmin) {
      return NextResponse.json({ error: error || "Non autorizzato" }, { status: 403 });
    }

    const { data, error: dbErr } = await supabase
      .from("moral_lessons")
      .select("*")
      .order("title", { ascending: true });

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ morals: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore recupero morali predefinite";
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
      .from("moral_lessons")
      .insert({
        title: body.title,
        description: body.description || "",
        category: body.category || "General",
        min_age: body.min_age ?? body.minAge ?? 3,
        max_age: body.max_age ?? body.maxAge ?? 12,
        is_premium: body.is_premium !== undefined ? body.is_premium : false,
      })
      .select()
      .single();

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, moral: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore creazione morale predefinita";
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
      return NextResponse.json({ error: "id richiesto" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const updates: Record<string, any> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.category !== undefined) updates.category = body.category;
    if (body.min_age !== undefined || body.minAge !== undefined) {
      updates.min_age = body.min_age ?? body.minAge;
    }
    if (body.max_age !== undefined || body.maxAge !== undefined) {
      updates.max_age = body.max_age ?? body.maxAge;
    }
    if (body.is_premium !== undefined || body.isPremium !== undefined) {
      updates.is_premium = body.is_premium ?? body.isPremium;
    }

    const { data, error: dbErr } = await adminClient
      .from("moral_lessons")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, moral: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore aggiornamento morale predefinita";
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
      return NextResponse.json({ error: "id richiesto" }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error: dbErr } = await adminClient
      .from("moral_lessons")
      .delete()
      .eq("id", id);

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore eliminazione morale predefinita";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
