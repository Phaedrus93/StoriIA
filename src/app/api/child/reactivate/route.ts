import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_LIMITS, SubscriptionTier } from "@/lib/config";
import { getSubscriptionPlan } from "@/lib/plans";

/**
 * Funzione core dell'endpoint /api/child/reactivate.
 * Verifica proprietà e conteggio profili attivi contro il limite del piano prima di riattivare il profilo sospeso.
 */
export async function reactivateChildProfileServer(
  client: any,
  adminClient: any,
  userId: string,
  childId: string
): Promise<{ success?: boolean; error?: string; status?: number; requiresUpgrade?: boolean }> {
  if (!childId) {
    return { error: "childId richiesto", status: 400 };
  }

  // 1. Verifica proprietà e famiglia
  const { data: child, error: childErr } = await client
    .from("child_profiles")
    .select("id, family_id, is_suspended")
    .eq("id", childId)
    .single();

  if (childErr || !child) {
    return { error: "Profilo bambino non trovato", status: 404 };
  }

  const { data: family } = await client
    .from("families")
    .select("id, parent_user_id, subscription_tier, addon_children_count")
    .eq("id", child.family_id)
    .single();

  if (!family || family.parent_user_id !== userId) {
    return { error: "Non autorizzato", status: 403 };
  }

  if (!child.is_suspended) {
    return { success: true, status: 200 };
  }

  // 2. Calcolo limite massimo e profili attivi attuali
  const tier = (family.subscription_tier || "free") as SubscriptionTier;
  const planData = await getSubscriptionPlan(tier, client);
  const baseLimit = planData.maxChildren;
  const maxAllowed = baseLimit + (family.addon_children_count || 0);

  const { count: activeCount } = await client
    .from("child_profiles")
    .select("id", { count: "exact", head: true })
    .eq("family_id", family.id)
    .eq("is_suspended", false);

  if ((activeCount || 0) >= maxAllowed) {
    return {
      error: `Hai raggiunto il limite massimo di ${maxAllowed} profili attivi per il piano ${tier.toUpperCase()}. Effettua l'upgrade o acquista uno slot aggiuntivo per riattivare questo profilo.`,
      requiresUpgrade: true,
      status: 403,
    };
  }

  // 3. Riattivazione sul database
  await adminClient
    .from("child_profiles")
    .update({ is_suspended: false })
    .eq("id", childId);

  return { success: true, status: 200 };
}

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
    const adminClient = createAdminClient();
    const res = await reactivateChildProfileServer(supabase, adminClient, user.id, childId);

    if (res.error) {
      return NextResponse.json(res, { status: res.status || 400 });
    }

    return NextResponse.json({ success: true, reactivatedChildId: childId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore riattivazione profilo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
