import { PLAN_LIMITS, SubscriptionTier } from "@/lib/config";
import { getSubscriptionPlan } from "@/lib/plans";
import { notifyFamily } from "@/lib/notifications";

/**
 * Sospende i profili bambino eccedenti quando la famiglia scende di tier (o cancella la subscription).
 * I profili più recenti (ORDER BY created_at DESC) vengono sospesi (is_suspended = true)
 * fino a rientrare nel limite massimo consentito dal nuovo piano.
 */
export async function enforceSuspensionOnDowngrade(
  adminClient: any,
  familyId: string,
  newTier: SubscriptionTier | string,
  options?: { keepChildIds?: string[] }
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

  let excessIds: string[] = [];

  // Se il genitore ha scelto esplicitamente quali profili mantenere
  if (options?.keepChildIds && Array.isArray(options.keepChildIds) && options.keepChildIds.length > 0) {
    const activeIds = new Set(activeChildren.map((c: { id: string }) => c.id));
    const validKeepIds = options.keepChildIds.filter((id) => activeIds.has(id)).slice(0, totalAllowed);

    if (validKeepIds.length > 0) {
      const keepSet = new Set(validKeepIds);
      // Se non ne ha scelti a sufficienza per riempire totalAllowed, aggiungiamo i più vecchi come fallback
      if (keepSet.size < totalAllowed) {
        for (const child of activeChildren) {
          if (!keepSet.has(child.id) && keepSet.size < totalAllowed) {
            keepSet.add(child.id);
          }
        }
      }
      excessIds = activeChildren.filter((c: { id: string }) => !keepSet.has(c.id)).map((c: { id: string }) => c.id);
    } else {
      // Nessun ID valido in keepChildIds, fallback su ordinamento cronologico
      const excessChildren = activeChildren.slice(totalAllowed);
      excessIds = excessChildren.map((c: { id: string }) => c.id);
    }
  } else {
    // Quando non è passata una scelta esplicita (es. downgrade automatico fine mese o webhook),
    // NON sospendiamo automaticamente alcun profilo in modo che activeChildren.length > totalAllowed
    // resti true e faccia scattare il modal di scelta obbligatorio e bloccante nella UI genitore.
    return { suspendedCount: 0 };
  }

  if (excessIds.length > 0) {
    await adminClient
      .from("child_profiles")
      .update({ is_suspended: true })
      .in("id", excessIds);
  }

  return { suspendedCount: excessIds.length };
}

/**
 * Controlla se la famiglia ha un abbonamento regalo attivo terminato (gift_subscription_expires_at nel passato).
 * Se sì, ripristina la famiglia al pre_gift_tier, applica enforceSuspensionOnDowngrade per bloccare profili eccedenti,
 * e invia una notifica all'utente.
 */
export async function checkAndExpireGiftSubscription(
  adminClient: any,
  familyId: string,
  familyRow?: any
): Promise<{ expired: boolean; newTier?: string }> {
  let family = familyRow;
  if (!family || family.gift_subscription_expires_at === undefined) {
    const { data } = await adminClient
      .from("families")
      .select("id, subscription_tier, subscription_status, stripe_subscription_id, gift_subscription_expires_at, pre_gift_tier")
      .eq("id", familyId)
      .single();
    family = data;
  }

  if (!family || !family.gift_subscription_expires_at) {
    return { expired: false };
  }

  const expiresAtDate = new Date(family.gift_subscription_expires_at);
  if (isNaN(expiresAtDate.getTime()) || expiresAtDate > new Date()) {
    return { expired: false };
  }

  // Il regalo è scaduto!
  const targetTier = family.pre_gift_tier || "free";

  // Se torna a free e non ha abbonamento Stripe pagato attivo, impostiamo status a 'canceled' per rispettare il vincolo CHECK SQL
  const hasActiveStripeSub = Boolean(family.stripe_subscription_id);
  const newStatus = targetTier === "free" && !hasActiveStripeSub ? "canceled" : (family.subscription_status || "active");

  await adminClient
    .from("families")
    .update({
      subscription_tier: targetTier,
      subscription_status: newStatus,
      gift_subscription_expires_at: null,
      pre_gift_tier: null,
    })
    .eq("id", familyId);

  // Applica obbligatoriamente enforceSuspensionOnDowngrade
  await enforceSuspensionOnDowngrade(adminClient, familyId, targetTier);

  // Invia notifica
  try {
    await notifyFamily({
      familyId,
      category: "billing",
      title: "Abbonamento Regalo Terminato ⌛",
      message: `Il tuo mese di abbonamento regalo è scaduto. Il tuo account è tornato al piano ${targetTier.toUpperCase()}.`,
      actionLink: "/billing",
    });
  } catch (err) {
    console.error("[checkAndExpireGiftSubscription] Errore invio notifica:", err instanceof Error ? err.message : "errore sconosciuto");
  }

  return { expired: true, newTier: targetTier };
}

/**
 * Al rinnovo o upgrade dell'abbonamento (o riscatto regalo abbonamento / add-on),
 * riattiva automaticamente tutti i profili sospesi della famiglia.
 * Se dopo la riattivazione il numero totale di profili attivi supera comunque la capienza del nuovo piano,
 * la UI del genitore farà scattare automaticamente il modale bloccante di selezione profili.
 */
export async function reactivateSuspendedChildrenOnUpgrade(
  adminClient: any,
  familyId: string
): Promise<{ reactivatedCount: number }> {
  const { data: suspendedChildren } = await adminClient
    .from("child_profiles")
    .select("id")
    .eq("family_id", familyId)
    .eq("is_suspended", true);

  if (!suspendedChildren || suspendedChildren.length === 0) {
    return { reactivatedCount: 0 };
  }

  const ids = suspendedChildren.map((c: { id: string }) => c.id);
  await adminClient
    .from("child_profiles")
    .update({ is_suspended: false })
    .in("id", ids);

  return { reactivatedCount: ids.length };
}

