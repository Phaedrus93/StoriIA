import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAllSubscriptionPlans } from "@/lib/plans";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { data: family, error: famErr } = await supabase
      .from("families")
      .select("id, subscription_tier, subscription_status, credits_balance, addon_children_count, pending_addon_children_count, stripe_subscription_id, parent_user_id")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json(
        { error: "Famiglia non trovata" },
        { status: 404 }
      );
    }

    const { data: ledger } = await supabase
      .from("credit_ledger")
      .select("*")
      .eq("family_id", family.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const plans = await getAllSubscriptionPlans(supabase);

    return NextResponse.json({
      family,
      tier: family.subscription_tier || "free",
      status: family.subscription_status || "active",
      creditsBalance: family.credits_balance || 0,
      addonCount: family.addon_children_count || 0,
      pendingAddonCount: family.pending_addon_children_count ?? null,
      stripeSubscriptionId: family.stripe_subscription_id || null,
      ledger: ledger || [],
      plans,
    }, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Errore lettura stato abbonamento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Ricarica o cambio piano simulato per test / demo ambiente dev
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

    const { data: family } = await supabase
      .from("families")
      .select("id, credits_balance")
      .eq("parent_user_id", user.id)
      .single();

    if (!family) {
      return NextResponse.json({ error: "Famiglia non trovata" }, { status: 404 });
    }

    const body = await req.json();
    const { action, creditsAmount, tier } = body;

    if (action === "add_credits") {
      const amount = Number(creditsAmount || 10);
      await supabase
        .from("families")
        .update({ credits_balance: (family.credits_balance || 0) + amount })
        .eq("id", family.id);

      await supabase.from("credit_ledger").insert({
        family_id: family.id,
        amount,
        transaction_type: "CREDIT_PACK_PURCHASE",
        description: `Ricarica pacchetto +${amount} storie AI`,
      });
    } else if (action === "change_tier") {
      await supabase
        .from("families")
        .update({
          subscription_tier: tier || "premium",
          subscription_status: "active",
        })
        .eq("id", family.id);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Errore aggiornamento abbonamento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
