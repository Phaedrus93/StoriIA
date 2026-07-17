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
      .from("stories")
      .select("*")
      .eq("is_preset", true)
      .order("created_at", { ascending: false });

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ preset_stories: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore recupero storie preset";
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
      .from("stories")
      .insert({
        title: body.title,
        content: body.content || "",
        summary: body.summary || "",
        cover_image_url: body.cover_image_url || body.coverImageUrl || null,
        age_group: body.age_group || body.ageGroup || "3-5",
        moral_lesson_id: body.moral_lesson_id || body.moralLessonId || null,
        is_preset: true,
      })
      .select()
      .single();

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, story: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore creazione storia preset";
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
    const updates: Record<string, any> = { is_preset: true };
    if (body.title !== undefined) updates.title = body.title;
    if (body.content !== undefined) updates.content = body.content;
    if (body.summary !== undefined) updates.summary = body.summary;
    if (body.cover_image_url !== undefined || body.coverImageUrl !== undefined) {
      updates.cover_image_url = body.cover_image_url || body.coverImageUrl;
    }
    if (body.age_group !== undefined || body.ageGroup !== undefined) {
      updates.age_group = body.age_group || body.ageGroup;
    }
    if (body.moral_lesson_id !== undefined || body.moralLessonId !== undefined) {
      updates.moral_lesson_id = body.moral_lesson_id || body.moralLessonId;
    }

    const { data, error: dbErr } = await adminClient
      .from("stories")
      .update(updates)
      .eq("id", body.id)
      .eq("is_preset", true)
      .select()
      .single();

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, story: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore aggiornamento storia preset";
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
      .from("stories")
      .delete()
      .eq("id", id)
      .eq("is_preset", true);

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore eliminazione storia preset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
