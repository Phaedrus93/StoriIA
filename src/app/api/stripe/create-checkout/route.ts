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

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
    }

    const { data: family } = await supabase
      .from("families")
      .select("id, stripe_customer_id")
      .eq("parent_user_id", user.id)
      .single();

    if (!family) {
      return NextResponse.json({ error: "Famiglia non trovata" }, { status: 404 });
    }

    const body = await req.json();
    const { type, priceKey, priceId: directPriceId, tier, creditsAmount, contentId } = body;

    const origin = req.headers.get("origin") || "http://localhost:3000";

    const resolvedPriceId = directPriceId || (priceKey ? PRICE_MAP[priceKey] : undefined);

    if (!resolvedPriceId) {
      return NextResponse.json({
        checkoutUrl: null,
        sandboxMode: true,
        message: "Configura le variabili STRIPE_PRICE_* in .env.local per attivare il checkout reale.",
      });
    }

    let customerId = family.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        metadata: { family_id: family.id },
      });
      customerId = customer.id;
      await supabase
        .from("families")
        .update({ stripe_customer_id: customerId })
        .eq("id", family.id);
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
      customer: customerId,
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
