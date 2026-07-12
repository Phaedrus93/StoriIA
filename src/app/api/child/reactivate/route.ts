import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_LIMITS, SubscriptionTier } from "@/lib/config";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { childId } = await req.json();

    if (!childId) {
      return NextResponse.json({ error: "childId richiesto" }, { status: 400 });
    }

    // 1. Verifica proprietà e famiglia
    const { data: child, error: childErr } = await supabase
      .from("child_profiles")
      .select("id, family_id, is_suspended")
      .eq("id", childId)
      .single();

    if (childErr || !child) {
      return NextResponse.json({ error: "Profilo bambino non trovato" }, { status: 404 });
    }

    const { data: family } = await supabase
      .from("families")
      .select("id, parent_user_id, subscription_tier, addon_children_count")
      .eq("id", child.family_id)
      .single();

    if (!family || family.parent_user_id !== user.id) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    if (!child.is_suspended) {
      return NextResponse.json({ success: true, message: "Profilo già attivo" });
    }

    // 2. Calcolo limite massimo e profili attivi attuali
    const tier = (family.subscription_tier || "free") as SubscriptionTier;
    const baseLimit = PLAN_LIMITS[tier]?.maxChildren || 1;
    const maxAllowed = baseLimit + (family.addon_children_count || 0);

    const { count: activeCount } = await supabase
      .from("child_profiles")
      .select("id", { count: "exact", head: true })
      .eq("family_id", family.id)
      .eq("is_suspended", false);

    if ((activeCount || 0) >= maxAllowed) {
      return NextResponse.json(
        {
          error: `Hai raggiunto il limite massimo di ${maxAllowed} profili attivi per il piano ${tier.toUpperCase()}. Effettua l'upgrade o acquista uno slot aggiuntivo per riattivare questo profilo.`,
          requiresUpgrade: true,
        },
        { status: 403 }
      );
    }

    // 3. Riattivazione sicura server-side
    const adminClient = createAdminClient();
    await adminClient
      .from("child_profiles")
      .update({ is_suspended: false })
      .eq("id", childId);

    return NextResponse.json({ success: true, reactivatedChildId: childId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore riattivazione profilo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
