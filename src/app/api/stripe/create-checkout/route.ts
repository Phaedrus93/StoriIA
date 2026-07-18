import { NextResponse } from "next/server";
import Stripe from "stripe";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_CONFIG } from "@/lib/config";

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
      .select("id, stripe_customer_id, addon_children_count")
      .eq("parent_user_id", user.id)
      .single();

    if (!family) {
      return NextResponse.json({ error: "Famiglia non trovata" }, { status: 404 });
    }

    const body = await req.json();
    const { type, priceKey, priceId: directPriceId, tier, creditsAmount, giftType: reqGiftType, amountOrTier: reqAmountOrTier } = body;

    if (type === "narrative_content") {
      return NextResponse.json(
        { error: "I contenuti narrativi possono essere sbloccati esclusivamente con Punti Avventura nel negozio gamification, mai tramite pagamento in denaro o crediti." },
        { status: 400 }
      );
    }

    if (type === "addon_child" || priceKey === "addon_child") {
      const currentAddons = family.addon_children_count || 0;
      if (currentAddons >= APP_CONFIG.addonChildren.maxPerFamily) {
        return NextResponse.json(
          { error: `Raggiunto il tetto massimo di ${APP_CONFIG.addonChildren.maxPerFamily} profili add-on per famiglia.` },
          { status: 400 }
        );
      }
    }

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

    if (type === "gift_code") {
      let giftType = reqGiftType;
      let amountOrTier = reqAmountOrTier;

      if (!giftType || !amountOrTier) {
        if (priceKey === "credits_10") { giftType = "credits"; amountOrTier = "10"; }
        else if (priceKey === "credits_25") { giftType = "credits"; amountOrTier = "25"; }
        else if (priceKey === "premium_monthly") { giftType = "subscription"; amountOrTier = "premium"; }
        else if (priceKey === "family_monthly") { giftType = "subscription"; amountOrTier = "family"; }
        else {
          return NextResponse.json({ error: "Tipo o valore di regalo non specificato o non valido." }, { status: 400 });
        }
      }

      const adminClient = createAdminClient();
      let secureCode = "";
      for (let i = 0; i < 5; i++) {
        const randHex = crypto.randomBytes(6).toString("hex").toUpperCase();
        secureCode = `GIFT-${randHex.slice(0, 4)}-${randHex.slice(4, 8)}-${randHex.slice(8, 12)}`;
        const { data: existing } = await adminClient.from("gift_codes").select("id").eq("code", secureCode).single();
        if (!existing) break;
      }

      const { data: giftRow, error: giftErr } = await adminClient
        .from("gift_codes")
        .insert({
          code: secureCode,
          type: giftType,
          amount_or_tier: amountOrTier,
          purchased_by_family_id: family.id,
          status: "pending",
        })
        .select("*")
        .single();

      if (giftErr || !giftRow) {
        return NextResponse.json({ error: "Errore durante la creazione del record regalo" }, { status: 500 });
      }

      metadata.gift_code_id = giftRow.id;
      metadata.gift_code = giftRow.code;
      metadata.gift_type = giftRow.type;
      metadata.amount_or_tier = giftRow.amount_or_tier;
    }

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
