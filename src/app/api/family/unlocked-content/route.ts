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

    // Profili bambino della famiglia per recuperare sblocchi individuali o familiari
    const { data: children } = await supabase
      .from("child_profiles")
      .select("id")
      .eq("family_id", family.id);
    const childIds = (children || []).map((c) => c.id);

    let unlockedChild: any[] = [];
    if (childIds.length > 0) {
      const { data: uc } = await supabase
        .from("child_unlocked_content")
        .select("content_id")
        .in("child_profile_id", childIds);
      if (uc) unlockedChild = uc;
    }

    let unlockedFam: any[] = [];
    try {
      const { data: uf, error: ufErr } = await supabase
        .from("family_unlocked_content")
        .select("content_id")
        .eq("family_id", family.id);
      if (!ufErr && uf) unlockedFam = uf;
    } catch {
      // Ignora se la tabella family_unlocked_content è stata droppata (migrazione V2)
    }

    const unlockedIds = new Set([
      ...unlockedChild.map((u) => u.content_id),
      ...unlockedFam.map((u) => u.content_id),
    ]);

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
