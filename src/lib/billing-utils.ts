import { PLAN_LIMITS, SubscriptionTier } from "@/lib/config";
import { getSubscriptionPlan } from "@/lib/plans";

/**
 * Sospende i profili bambino eccedenti quando la famiglia scende di tier (o cancella la subscription).
 * I profili più recenti (ORDER BY created_at DESC) vengono sospesi (is_suspended = true)
 * fino a rientrare nel limite massimo consentito dal nuovo piano.
 */
export async function enforceSuspensionOnDowngrade(
  adminClient: any,
  familyId: string,
  newTier: SubscriptionTier | string
): Promise<{ suspendedCount: number }> {
  const planData = await getSubscriptionPlan(newTier, adminClient);
  const maxAllowed = planData.maxChildren;

  // Verifica anche eventuali addon_children_count
  const { data: family } = await adminClient
    .from("families")
    .select("addon_children_count")
    .eq("id", familyId)
    .single();

  const totalAllowed = maxAllowed + (family?.addon_children_count || 0);

  // Leggi i profili attualmente attivi non sospesi ordinati per data di creazione
  const { data: activeChildren } = await adminClient
    .from("child_profiles")
    .select("id, created_at")
    .eq("family_id", familyId)
    .eq("is_suspended", false)
    .order("created_at", { ascending: true });

  if (!activeChildren || activeChildren.length <= totalAllowed) {
    return { suspendedCount: 0 };
  }

  // I profili che eccedono il numero totalAllowed partendo dagli ultimi creati
  const excessChildren = activeChildren.slice(totalAllowed);

  const excessIds = excessChildren.map((c: { id: string }) => c.id);

  if (excessIds.length > 0) {
    await adminClient
      .from("child_profiles")
      .update({ is_suspended: true })
      .in("id", excessIds);
  }

  return { suspendedCount: excessIds.length };
}
