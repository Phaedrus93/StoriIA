import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    if (user.app_metadata?.is_child_mode) {
      return NextResponse.json(
        { error: "Accesso riservato al genitore." },
        { status: 403 }
      );
    }

    const { data: family, error: famErr } = await supabase
      .from("families")
      .select("*")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json(
        { error: "Famiglia non trovata" },
        { status: 404 }
      );
    }

    let preset = null;
    if (family.parent_avatar_preset_id) {
      const { data: presetData } = await supabase
        .from("avatar_presets")
        .select("*")
        .eq("id", family.parent_avatar_preset_id)
        .maybeSingle();
      preset = presetData;
    }

    let badge = null;
    if (family.parent_equipped_badge_id) {
      const { data: badgeData } = await supabase
        .from("cosmetic_items")
        .select("*")
        .eq("id", family.parent_equipped_badge_id)
        .maybeSingle();
      badge = badgeData;
    }

    let frame = null;
    if (family.parent_equipped_frame_id) {
      const { data: frameData } = await supabase
        .from("cosmetic_items")
        .select("*")
        .eq("id", family.parent_equipped_frame_id)
        .maybeSingle();
      frame = frameData;
    }

    return NextResponse.json({
      profile: {
        family_id: family.id,
        email: user.email || "",
        parent_display_name: family.parent_display_name || "Genitore StoriIA",
        parent_role: family.parent_role || "Genitore",
        parent_avatar_preset_id: family.parent_avatar_preset_id || null,
        parent_equipped_badge_id: family.parent_equipped_badge_id || null,
        parent_equipped_frame_id: family.parent_equipped_frame_id || null,
        subscription_tier: family.subscription_tier,
        subscription_status: family.subscription_status,
        created_at: family.created_at,
        preset,
        badge,
        frame,
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Errore lettura profilo genitore";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    if (user.app_metadata?.is_child_mode) {
      return NextResponse.json(
        { error: "La modifica del profilo è riservata al genitore." },
        { status: 403 }
      );
    }

    const { data: family, error: famErr } = await supabase
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json(
        { error: "Famiglia non trovata" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const {
      parent_display_name,
      parent_role,
      parent_avatar_preset_id,
      parent_equipped_badge_id,
      parent_equipped_frame_id,
    } = body;

    const updatePayload: Record<string, any> = {};

    if (parent_display_name !== undefined) {
      const trimmed = String(parent_display_name).trim();
      if (trimmed.length > 100) {
        return NextResponse.json(
          { error: "Il nome non può superare i 100 caratteri." },
          { status: 400 }
        );
      }
      updatePayload.parent_display_name = trimmed || "Genitore StoriIA";
    }

    if (parent_role !== undefined) {
      const trimmedRole = String(parent_role).trim();
      if (trimmedRole.length > 50) {
        return NextResponse.json(
          { error: "Il ruolo non può superare i 50 caratteri." },
          { status: 400 }
        );
      }
      updatePayload.parent_role = trimmedRole || "Genitore";
    }

    if (parent_avatar_preset_id !== undefined) {
      updatePayload.parent_avatar_preset_id = parent_avatar_preset_id || null;
    }

    if (parent_equipped_badge_id !== undefined) {
      updatePayload.parent_equipped_badge_id = parent_equipped_badge_id || null;
    }

    if (parent_equipped_frame_id !== undefined) {
      updatePayload.parent_equipped_frame_id = parent_equipped_frame_id || null;
    }

    const { data: updated, error: updateErr } = await supabase
      .from("families")
      .update(updatePayload)
      .eq("id", family.id)
      .select("*")
      .single();

    if (updateErr) {
      return NextResponse.json(
        { error: `Errore aggiornamento profilo: ${updateErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: updated,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Errore aggiornamento profilo genitore";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
