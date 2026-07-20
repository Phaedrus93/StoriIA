import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionPlan } from "@/lib/plans";
import { SubscriptionTier } from "@/lib/config";

/**
 * GET /api/family/limit-check
 * Verifica se il numero di profili attivi supera il limite massimo consentito dal piano.
 * Usato dalla UI genitore per mostrare il modale obbligatorio di selezione profili al superamento del limite.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { data: family, error: famErr } = await supabase
      .from("families")
      .select("id, subscription_tier, addon_children_count")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json({ error: "Famiglia non trovata" }, { status: 404 });
    }

    const tier = (family.subscription_tier || "free") as SubscriptionTier;
    const addonCount = family.addon_children_count || 0;
    const planLimit = await getSubscriptionPlan(tier, supabase);
    const maxAllowed = planLimit.maxChildren + addonCount;

    const { data: activeChildren, error: childErr } = await supabase
      .from("child_profiles")
      .select("id, name, gender, avatar_preset_id")
      .eq("family_id", family.id)
      .eq("is_suspended", false)
      .order("created_at", { ascending: true });

    if (childErr || !activeChildren) {
      return NextResponse.json({ error: "Errore caricamento profili" }, { status: 500 });
    }

    const activeCount = activeChildren.length;
    const requiresSelection = activeCount > maxAllowed;

    return NextResponse.json({
      activeCount,
      maxAllowed,
      tier,
      addonCount,
      requiresSelection,
      activeChildren: requiresSelection ? activeChildren : [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore verifica limiti profili";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
