import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/family/unlocked-content
 * Ritorna i contenuti narrativi sbloccati dalla famiglia raggruppati per tipo.
 * Risposta: { characterTraits, settingThemes, storyStyles, all }
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
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

    // Catalogo completo
    const { data: catalog } = await supabase
      .from("narrative_content_catalog")
      .select("*")
      .eq("is_active", true)
      .order("content_type", { ascending: true });

    // Sbloccati dalla famiglia
    const { data: unlocked } = await supabase
      .from("family_unlocked_content")
      .select("content_id, unlocked_via, unlocked_at")
      .eq("family_id", family.id);

    const unlockedIds = new Set((unlocked || []).map((u) => u.content_id));

    const enriched = (catalog || []).map((item) => ({
      ...item,
      isUnlocked: unlockedIds.has(item.id),
    }));

    return NextResponse.json({
      all: enriched,
      characterTraits: enriched.filter((i) => i.content_type === "CHARACTER_TRAIT"),
      settingThemes: enriched.filter((i) => i.content_type === "SETTING_THEME"),
      storyStyles: enriched.filter((i) => i.content_type === "STORY_STYLE"),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore lettura contenuti sbloccati";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
