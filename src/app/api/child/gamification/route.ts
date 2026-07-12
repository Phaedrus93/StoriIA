import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const url = new URL(req.url);
    const childId = url.searchParams.get("childId");

    if (!childId) {
      return NextResponse.json({ error: "parametro childId mancante" }, { status: 400 });
    }

    // 1. Dati profilo, punti avventura, badge/frame attivi
    const { data: child, error: childErr } = await supabase
      .from("child_profiles")
      .select("id, name, adventure_points, avatar_preset_id, active_badge_id, active_frame_id")
      .eq("id", childId)
      .single();

    if (childErr || !child) {
      return NextResponse.json({ error: "Profilo bambino non trovato" }, { status: 404 });
    }

    // 2. Piano abbonamento della famiglia (per mostrare lock cosmetici)
    const { data: familyData } = await supabase
      .from("child_profiles")
      .select("family_id")
      .eq("id", childId)
      .single();

    let familyTier = "free";
    if (familyData?.family_id) {
      const { data: fam } = await supabase
        .from("families")
        .select("subscription_tier")
        .eq("id", familyData.family_id)
        .single();
      familyTier = fam?.subscription_tier || "free";
    }

    // 3. Catalogo missioni di lettura e progressi
    const { data: quests } = await supabase
      .from("reading_quests")
      .select("*")
      .order("target_count", { ascending: true });

    const { data: progressList } = await supabase
      .from("child_quest_progress")
      .select("*")
      .eq("child_profile_id", childId);

    // 4. Catalogo premi cosmetici e sbloccati
    const { data: cosmetics } = await supabase
      .from("cosmetic_items")
      .select("*")
      .order("cost_points", { ascending: true });

    const { data: unlockedList } = await supabase
      .from("child_unlocked_cosmetics")
      .select("*")
      .eq("child_profile_id", childId);

    return NextResponse.json({
      child,
      familyTier,
      quests: quests || [],
      progress: progressList || [],
      cosmetics: cosmetics || [],
      unlocked: unlockedList || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore gamification get";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const { action, childId, cosmeticId } = body;

    if (!childId) {
      return NextResponse.json({ error: "childId obbligatorio" }, { status: 400 });
    }

    const { data: child, error: childErr } = await supabase
      .from("child_profiles")
      .select("id, name, adventure_points")
      .eq("id", childId)
      .single();

    if (childErr || !child) {
      return NextResponse.json({ error: "Profilo bambino non trovato" }, { status: 404 });
    }

    const currentPoints = child.adventure_points || 0;

    if (action === "award_reading_points") {
      const rewardAmount = 15; // +15 Punti Avventura per ogni lettura completata
      const newPoints = currentPoints + rewardAmount;

      await supabase
        .from("child_profiles")
        .update({ adventure_points: newPoints })
        .eq("id", childId);

      // Aggiorna anche l'avanzamento delle missioni attive
      const { data: quests } = await supabase.from("reading_quests").select("*");
      if (quests && quests.length > 0) {
        for (const q of quests) {
          const { data: existingProg } = await supabase
            .from("child_quest_progress")
            .select("*")
            .eq("child_profile_id", childId)
            .eq("quest_id", q.id)
            .maybeSingle();

          const currentCount = (existingProg?.current_progress || 0) + 1;
          const isCompletedNow = currentCount >= q.target_count && !existingProg?.completed_at;

          await supabase
            .from("child_quest_progress")
            .upsert(
              {
                child_profile_id: childId,
                quest_id: q.id,
                current_progress: currentCount,
                completed_at: isCompletedNow
                  ? new Date().toISOString()
                  : existingProg?.completed_at || null,
              },
              { onConflict: "child_profile_id,quest_id" }
            );

          // Se completata per la prima volta, assegna anche i punti premio missione
          if (isCompletedNow) {
            const bonus = q.points_reward || 15;
            await supabase
              .from("child_profiles")
              .update({ adventure_points: newPoints + bonus })
              .eq("id", childId);
          }
        }
      }

      return NextResponse.json({
        success: true,
        adventurePoints: newPoints,
        rewardGiven: rewardAmount,
      });
    }

    if (action === "unlock_cosmetic") {
      if (!cosmeticId) {
        return NextResponse.json({ error: "cosmeticId mancante" }, { status: 400 });
      }

      const { data: cosmetic } = await supabase
        .from("cosmetic_items")
        .select("*")
        .eq("id", cosmeticId)
        .single();

      if (!cosmetic) {
        return NextResponse.json({ error: "Cosmetico non trovato" }, { status: 404 });
      }

      // Verifica piano richiesto
      const { data: childFamData } = await supabase
        .from("child_profiles")
        .select("family_id")
        .eq("id", childId)
        .single();

      if (childFamData?.family_id) {
        const { data: fam } = await supabase
          .from("families")
          .select("subscription_tier")
          .eq("id", childFamData.family_id)
          .single();

        const tier = fam?.subscription_tier || "free";
        const tierOrder: Record<string, number> = { free: 0, premium: 1, family: 2 };
        const requiredOrder = tierOrder[cosmetic.requires_plan || "free"] ?? 0;
        const currentOrder = tierOrder[tier] ?? 0;

        if (currentOrder < requiredOrder) {
          return NextResponse.json({
            error: `Questo premio richiede il piano ${cosmetic.requires_plan?.toUpperCase()}`,
            requiresUpgrade: true,
            requiredPlan: cosmetic.requires_plan,
          }, { status: 403 });
        }
      }

      // Verifica se già sbloccato
      const { data: alreadyUnlocked } = await supabase
        .from("child_unlocked_cosmetics")
        .select("id")
        .eq("child_profile_id", childId)
        .eq("cosmetic_id", cosmeticId)
        .maybeSingle();

      if (alreadyUnlocked) {
        return NextResponse.json({
          error: "Hai già sbloccato questo premio!",
          alreadyUnlocked: true,
        }, { status: 400 });
      }

      if (currentPoints < cosmetic.cost_points) {
        return NextResponse.json({
          error: "Punti Avventura insufficienti per questo premio!",
          insufficientPoints: true,
        }, { status: 400 });
      }

      const remainingPoints = currentPoints - cosmetic.cost_points;

      await supabase
        .from("child_profiles")
        .update({ adventure_points: remainingPoints })
        .eq("id", childId);

      await supabase.from("child_unlocked_cosmetics").insert({
        child_profile_id: childId,
        cosmetic_id: cosmeticId,
      });

      return NextResponse.json({
        success: true,
        adventurePoints: remainingPoints,
        unlockedCosmeticId: cosmeticId,
      });
    }

    if (action === "set_active_cosmetic") {
      const { slot, cosmeticId: activeCosmeticId } = body;
      // slot: 'badge' | 'frame' | null (null = rimuovi)
      if (!slot || !["badge", "frame"].includes(slot)) {
        return NextResponse.json({ error: "slot deve essere 'badge' o 'frame'" }, { status: 400 });
      }

      const updateField = slot === "badge" ? "active_badge_id" : "active_frame_id";

      if (activeCosmeticId) {
        // Verifica che il cosmetico sia effettivamente sbloccato da questo bambino
        const { data: owned } = await supabase
          .from("child_unlocked_cosmetics")
          .select("id")
          .eq("child_profile_id", childId)
          .eq("cosmetic_id", activeCosmeticId)
          .maybeSingle();

        if (!owned) {
          return NextResponse.json({ error: "Cosmetico non sbloccato" }, { status: 403 });
        }
      }

      await supabase
        .from("child_profiles")
        .update({ [updateField]: activeCosmeticId || null })
        .eq("id", childId);

      return NextResponse.json({ success: true, slot, active: activeCosmeticId || null });
    }

    return NextResponse.json({ error: "Azione non supportata" }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore gamification post";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
