import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAdminPrivileges, createAdminClient } from "@/lib/admin";

function enrichStory(s: any) {
  if (!s) return s;
  let title = s.title;
  let content = s.content || s.generated_text || "";
  let summary = s.summary || "";

  if (!title && content) {
    const lines = content.split("\n").filter((l: string) => l.trim().length > 0);
    if (lines[0] && lines[0].startsWith("#")) {
      title = lines[0].replace(/^#\s*/, "").trim();
      content = lines.slice(1).join("\n").trim();
    } else {
      title = "Storia Preset";
    }
  }

  if (!summary && content) {
    summary = content.slice(0, 120) + (content.length > 120 ? "..." : "");
  }

  return {
    ...s,
    title: title || "Storia Preset",
    content,
    summary,
    age_group: s.age_group || s.target_age_range || "4-6",
    is_preset: true,
  };
}

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
      .eq("source", "preset")
      .order("created_at", { ascending: false });

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ preset_stories: (data || []).map(enrichStory) });
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

    const fullContent = body.title && !body.content?.startsWith("#")
      ? `# ${body.title}\n\n${body.content || ""}`
      : body.content || `# ${body.title || "Storia Preset"}\n\n`;

    const { data, error: dbErr } = await adminClient
      .from("stories")
      .insert({
        target_age_range: body.age_group || body.ageGroup || "4-6",
        generated_text: fullContent,
        source: "preset",
      })
      .select()
      .single();

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, story: enrichStory(data) });
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
    const updates: Record<string, any> = { source: "preset" };

    if (body.title !== undefined || body.content !== undefined) {
      const fullContent = body.title && !body.content?.startsWith("#")
        ? `# ${body.title}\n\n${body.content || ""}`
        : body.content || `# ${body.title || ""}`;
      updates.generated_text = fullContent;
    }
    if (body.age_group !== undefined || body.ageGroup !== undefined) {
      updates.target_age_range = body.age_group || body.ageGroup;
    }

    const { data, error: dbErr } = await adminClient
      .from("stories")
      .update(updates)
      .eq("id", body.id)
      .eq("source", "preset")
      .select()
      .single();

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, story: enrichStory(data) });
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
      .eq("source", "preset");

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore eliminazione storia preset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
