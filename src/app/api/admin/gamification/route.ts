import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAdminPrivileges, createAdminClient } from "@/lib/admin";

function enrichQuest(q: any) {
  if (!q) return q;
  return {
    ...q,
    required_count: q.target_count ?? q.required_count ?? 0,
    reward_points: q.points_reward ?? q.reward_points ?? 0,
  };
}

function enrichCosmetic(c: any) {
  if (!c) return c;
  return {
    ...c,
    type: c.category === "BADGE" || c.type === "badge" ? "badge" : "frame",
    icon_value: c.icon_preset ?? c.icon_value ?? "",
    unlock_requirement: c.unlock_requirement ?? "",
    frame_color: c.frame_color ?? "",
    frame_effect: c.frame_effect ?? "",
  };
}

function normalizePayload(table: string, payload: any) {
  if (table === "reading_quests") {
    if (payload.required_count !== undefined) {
      payload.target_count = payload.required_count;
      delete payload.required_count;
    }
    if (payload.reward_points !== undefined) {
      payload.points_reward = payload.reward_points;
      delete payload.reward_points;
    }
    if (!payload.quest_type) {
      payload.quest_type = "READING_COUNT";
    }
  } else if (table === "cosmetic_items") {
    const rawType = payload.type || payload.category;
    if (rawType !== undefined) {
      payload.category = typeof rawType === "string" && rawType.toUpperCase() === "BADGE" ? "BADGE" : "AVATAR_FRAME";
    } else if (!payload.category) {
      payload.category = "BADGE";
    }
    if (payload.icon_value !== undefined) {
      payload.icon_preset = payload.icon_value;
      delete payload.icon_value;
    }
    if (!payload.requires_plan) {
      payload.requires_plan = "free";
    }
    if (payload.category === "BADGE") {
      payload.frame_color = null;
      payload.frame_effect = null;
    } else {
      payload.unlock_requirement = null;
      if (payload.icon_preset === undefined) payload.icon_preset = "";
    }
  }
  delete payload.table;
  delete payload.type;
  return payload;
}

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
      const { data, error: dbErr } = await supabase.from("reading_quests").select("*").order("target_count", { ascending: true });
      if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
      return NextResponse.json({ reading_quests: (data || []).map(enrichQuest) });
    }

    if (type === "cosmetic_items") {
      const { data, error: dbErr } = await supabase.from("cosmetic_items").select("*").order("cost_points", { ascending: true });
      if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
      return NextResponse.json({ cosmetic_items: (data || []).map(enrichCosmetic) });
    }

    const { data: quests } = await supabase.from("reading_quests").select("*").order("target_count", { ascending: true });
    const { data: cosmetics } = await supabase.from("cosmetic_items").select("*").order("cost_points", { ascending: true });

    return NextResponse.json({
      reading_quests: (quests || []).map(enrichQuest),
      cosmetic_items: (cosmetics || []).map(enrichCosmetic),
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
    const payload = normalizePayload(table, { ...body });

    const { data, error: dbErr } = await adminClient
      .from(table)
      .insert(payload)
      .select()
      .single();

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    const enrichedItem = table === "reading_quests" ? enrichQuest(data) : enrichCosmetic(data);
    return NextResponse.json({ success: true, item: enrichedItem });
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

    const normalized = normalizePayload(table, payload);

    const { data, error: dbErr } = await adminClient
      .from(table)
      .update(normalized)
      .eq("id", id)
      .select()
      .single();

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    const enrichedItem = table === "reading_quests" ? enrichQuest(data) : enrichCosmetic(data);
    return NextResponse.json({ success: true, item: enrichedItem });
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
