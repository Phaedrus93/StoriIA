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
        { error: "Nessun abbonamento a pagamento attivo da riattivare" },
        { status: 400 }
      );
    }

    // 1. Chiama prima Stripe per riattivare il rinnovo automatico
    if (family.stripe_subscription_id) {
      try {
        await stripe.subscriptions.update(family.stripe_subscription_id, {
          cancel_at_period_end: false,
        });
      } catch (stripeErr: unknown) {
        const errMessage =
          stripeErr instanceof Error ? stripeErr.message : "Errore API Stripe";
        return NextResponse.json(
          {
            error: `Impossibile riattivare l'abbonamento su Stripe: ${errMessage}`,
          },
          { status: 502 }
        );
      }
    }

    // 2. Aggiorna lo stato nel database locale SOLO se Stripe ha avuto successo
    const { error: updateErr } = await supabase
      .from("families")
      .update({
        subscription_status: "active",
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
      message: "Il rinnovo automatico del tuo abbonamento è stato riattivato con successo.",
      status: "active",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore interno al server";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
