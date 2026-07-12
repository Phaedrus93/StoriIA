import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_LIMITS, SubscriptionTier } from "@/lib/config";
import { enforceSuspensionOnDowngrade } from "@/lib/billing-utils";

/**
 * POST /api/family/downgrade-tier
 * Applica il cambio di piano/downgrade a un tier specificato e
 * invoca immediatamente la sospensione dei profili bambino eccedenti.
 */
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

    const { newTier } = await req.json();

    if (!newTier || !(newTier in PLAN_LIMITS)) {
      return NextResponse.json({ error: "Piano non valido" }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: family, error: famErr } = await adminClient
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json({ error: "Famiglia non trovata" }, { status: 404 });
    }

    // 1. Aggiornamento tier
    await adminClient
      .from("families")
      .update({ subscription_tier: newTier as SubscriptionTier })
      .eq("id", family.id);

    // 2. Sospensione reale profili bambino eccedenti
    const { suspendedCount } = await enforceSuspensionOnDowngrade(
      adminClient,
      family.id,
      newTier as SubscriptionTier
    );

    return NextResponse.json({
      success: true,
      familyId: family.id,
      newTier,
      suspendedCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore durante il cambio piano";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
