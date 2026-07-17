import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_LIMITS, SubscriptionTier } from "@/lib/config";
import { enforceSuspensionOnDowngrade } from "@/lib/billing-utils";
import { getSubscriptionPlan } from "@/lib/plans";

/**
 * POST /api/family/downgrade-tier
 * Applica il cambio di piano/downgrade a un tier specificato e
 * invoca immediatamente la sospensione dei profili bambino eccedenti.
 */
/**
 * Funzione core dell'endpoint /api/family/downgrade-tier.
 * Verifica che il nuovo tier sia di livello pari o inferiore al corrente,
 * esegue l'aggiornamento sul DB e chiama enforceSuspensionOnDowngrade.
 */
export async function downgradeFamilyTierServer(
  adminClient: any,
  userId: string,
  newTier: string
): Promise<{ success?: boolean; error?: string; status?: number; suspendedCount?: number; tier?: string; newTier?: string }> {
  const TIER_RANK: Record<string, number> = {
    free: 1,
    premium: 2,
    family: 3,
  };

  const planData = await getSubscriptionPlan(newTier, adminClient);
  if (!newTier || !planData || !TIER_RANK[newTier]) {
    return { error: "Piano non valido", status: 400 };
  }

  const { data: family, error: famErr } = await adminClient
    .from("families")
    .select("id, subscription_tier")
    .eq("parent_user_id", userId)
    .single();

  if (famErr || !family) {
    return { error: "Famiglia non trovata", status: 404 };
  }

  const currentTier = (family.subscription_tier || "free") as string;
  const currentRank = TIER_RANK[currentTier] || 1;
  const newRank = TIER_RANK[newTier] || 1;

  if (newRank > currentRank) {
    return {
      error:
        "L'upgrade a un piano superiore non è consentito tramite questo endpoint. Effettua l'upgrade tramite Stripe Checkout.",
      status: 403,
    };
  }

  if (newRank === currentRank) {
    return {
      error: "Il downgrade richiede la selezione di un piano inferiore a quello attuale.",
      status: 400,
    };
  }

  await adminClient
    .from("families")
    .update({ subscription_tier: newTier as SubscriptionTier })
    .eq("id", family.id);

  const { suspendedCount } = await enforceSuspensionOnDowngrade(
    adminClient,
    family.id,
    newTier as SubscriptionTier
  );

  return { success: true, suspendedCount, tier: newTier, newTier, status: 200 };
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

    if (user.app_metadata?.is_child_mode) {
      return NextResponse.json(
        { error: "Il cambio di abbonamento è riservato al genitore." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const newTier = body.newTier || body.targetTier;
    const adminClient = createAdminClient();
    const res = await downgradeFamilyTierServer(adminClient, user.id, newTier);

    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: res.status || 400 });
    }

    return NextResponse.json(res);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore durante il cambio piano";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
