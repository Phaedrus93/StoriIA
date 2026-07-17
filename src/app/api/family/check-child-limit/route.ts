import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PLAN_LIMITS, type SubscriptionTier } from "@/lib/config";
import { getSubscriptionPlan } from "@/lib/plans";

/**
 * GET /api/family/check-child-limit
 * Verifica se la famiglia può aggiungere un nuovo profilo bambino in base al piano.
 * Risposta: { canAdd, currentCount, maxAllowed, tier, addonCount }
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

    const { count: currentCount } = await supabase
      .from("child_profiles")
      .select("id", { count: "exact", head: true })
      .eq("family_id", family.id);

    const count = currentCount ?? 0;
    const canAdd = count < maxAllowed;

    return NextResponse.json({
      canAdd,
      currentCount: count,
      maxAllowed,
      tier,
      addonCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore verifica limite bambini";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
