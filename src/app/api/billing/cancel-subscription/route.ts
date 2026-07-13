import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2026-06-24.dahlia",
});

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { data: family, error: famErr } = await supabase
      .from("families")
      .select("id, subscription_tier, subscription_status, stripe_subscription_id")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json({ error: "Famiglia non trovata" }, { status: 404 });
    }

    if (family.subscription_tier === "free") {
      return NextResponse.json(
        { error: "Nessun abbonamento a pagamento attivo da cancellare" },
        { status: 400 }
      );
    }

    // 1. Se presente lo stripe_subscription_id, chiama PRIMA l'API Stripe per disdire il rinnovo
    if (family.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(family.stripe_subscription_id, {
          cancel_at_period_end: true,
        });
      } catch (stripeErr: unknown) {
        const errMessage =
          stripeErr instanceof Error ? stripeErr.message : "Errore API Stripe";
        // Se la chiamata Stripe fallisce, non aggiornare il database locale
        return NextResponse.json(
          {
            error: `Impossibile cancellare l'abbonamento su Stripe: ${errMessage}`,
          },
          { status: 502 }
        );
      }
    }

    // 2. Aggiorna lo stato nel database locale SOLO dopo il successo della chiamata Stripe
    const { error: updateErr } = await supabase
      .from("families")
      .update({
        subscription_status: "canceling_at_period_end",
      })
      .eq("id", family.id);

    if (updateErr) {
      return NextResponse.json(
        { error: "Impossibile aggiornare lo stato di abbonamento locale" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "L'abbonamento non sarà rinnovato alla scadenza e resterà attivo fino a fine periodo.",
      status: "canceling_at_period_end",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore interno al server";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
