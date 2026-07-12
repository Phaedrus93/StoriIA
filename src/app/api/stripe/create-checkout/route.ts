import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2026-06-24.dahlia",
});

const PRICE_MAP: Record<string, string | undefined> = {
  premium_monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
  family_monthly:  process.env.STRIPE_PRICE_FAMILY_MONTHLY,
  addon_child:     process.env.STRIPE_PRICE_ADDON_CHILD,
  credits_10:      process.env.STRIPE_PRICE_CREDITS_10,
  credits_25:      process.env.STRIPE_PRICE_CREDITS_25,
};

/**
 * POST /api/stripe/create-checkout
 * Crea una Stripe Checkout Session e ritorna l'URL di pagamento.
 *
 * Body:
 * {
 *   type: 'subscription' | 'credit_pack' | 'addon_child' | 'narrative_content',
 *   priceKey?: keyof PRICE_MAP,       // es. 'premium_monthly'
 *   priceId?: string,                  // Price ID diretto (per contenuti narrativi)
 *   tier?: string,                     // es. 'premium'
 *   creditsAmount?: number,            // es. 10
 *   contentId?: string,                // ID narrative_content_catalog
 * }
 */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { data: family } = await supabase
      .from("families")
      .select("id")
      .eq("parent_user_id", user.id)
      .single();

    if (!family) {
      return NextResponse.json({ error: "Famiglia non trovata" }, { status: 404 });
    }

    const body = await req.json();
    const { type, priceKey, priceId: directPriceId, tier, creditsAmount, contentId } = body;

    const origin = req.headers.get("origin") || "http://localhost:3000";

    // Risolve il Price ID Stripe
    const resolvedPriceId = directPriceId || (priceKey ? PRICE_MAP[priceKey] : undefined);

    if (!resolvedPriceId) {
      // Se non c'è ancora il Price ID configurato, ritorna mock URL per sandbox
      return NextResponse.json({
        checkoutUrl: null,
        sandboxMode: true,
        message: "Configura le variabili STRIPE_PRICE_* in .env.local per attivare il checkout reale.",
      });
    }

    const isSubscription = type === "subscription" || type === "addon_child";

    const metadata: Record<string, string> = {
      family_id: family.id,
      purchase_type: type,
    };

    if (tier) metadata.plan_tier = tier;
    if (creditsAmount) metadata.credits_amount = String(creditsAmount);
    if (contentId) metadata.content_id = contentId;

    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? "subscription" : "payment",
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      metadata,
      ...(isSubscription ? { subscription_data: { metadata } } : { payment_intent_data: { metadata } }),
      success_url: `${origin}/billing?checkout=success`,
      cancel_url:  `${origin}/billing?checkout=canceled`,
      locale: "it",
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore creazione sessione Stripe";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
