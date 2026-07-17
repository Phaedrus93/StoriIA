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
      .from("avatar_presets")
      .select("*")
      .order("display_order", { ascending: true });

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ presets: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore recupero preset avatar";
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
      .from("avatar_presets")
      .insert({
        name: body.name,
        image_url: body.image_url || body.imageUrl,
        gender: body.gender || "neutral",
        is_active: body.is_active !== undefined ? body.is_active : true,
        display_order: body.display_order ?? body.displayOrder ?? 0,
      })
      .select()
      .single();

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, preset: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore creazione preset avatar";
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
    if (body.name !== undefined) updates.name = body.name;
    if (body.image_url !== undefined || body.imageUrl !== undefined) {
      updates.image_url = body.image_url || body.imageUrl;
    }
    if (body.gender !== undefined) updates.gender = body.gender;
    if (body.is_active !== undefined || body.isActive !== undefined) {
      updates.is_active = body.is_active ?? body.isActive;
    }
    if (body.display_order !== undefined || body.displayOrder !== undefined) {
      updates.display_order = body.display_order ?? body.displayOrder;
    }

    const { data, error: dbErr } = await adminClient
      .from("avatar_presets")
      .update(updates)
      .eq("id", body.id)
      .select()
      .single();

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, preset: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore aggiornamento preset avatar";
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
      .from("avatar_presets")
      .delete()
      .eq("id", id);

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore eliminazione preset avatar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
