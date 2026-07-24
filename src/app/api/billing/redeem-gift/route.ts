import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSubscriptionPlan } from "@/lib/plans";
import { notifyFamily } from "@/lib/notifications";
import { reactivateSuspendedChildrenOnUpgrade } from "@/lib/billing-utils";

export async function POST(req: Request) {
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
      .select("id, subscription_tier, subscription_status, stripe_subscription_id, credits_balance, gift_subscription_expires_at, pre_gift_tier")
      .eq("parent_user_id", user.id)
      .single();

    if (famErr || !family) {
      return NextResponse.json({ error: "Famiglia non trovata" }, { status: 404 });
    }

    const body = await req.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Codice regalo non fornito" }, { status: 400 });
    }

    const normalizedCode = code.trim().toUpperCase();
    const adminClient = createAdminClient();

    // 1. Leggi il codice regalo via adminClient
    const { data: gift, error: giftErr } = await adminClient
      .from("gift_codes")
      .select("*")
      .eq("code", normalizedCode)
      .single();

    if (giftErr || !gift || gift.status !== "active" || gift.redeemed_by_family_id || gift.redeemed_at) {
      return NextResponse.json(
        { error: "Codice regalo non valido, scaduto o già riscattato." },
        { status: 400 }
      );
    }

    // 2. Gestione riscatto in base al tipo
    if (gift.type === "credits") {
      const creditsToAdd = Number(gift.amount_or_tier);
      if (isNaN(creditsToAdd) || creditsToAdd <= 0) {
        return NextResponse.json({ error: "Importo crediti non valido nel codice regalo" }, { status: 400 });
      }

      await adminClient
        .from("families")
        .update({ credits_balance: (family.credits_balance || 0) + creditsToAdd })
        .eq("id", family.id);

      await adminClient.from("credit_ledger").insert({
        family_id: family.id,
        amount: creditsToAdd,
        transaction_type: "GIFT_REDEMPTION",
        description: `Riscatto codice regalo +${creditsToAdd} crediti`,
      });
    } else if (gift.type === "subscription") {
      const tierToApply = (gift.amount_or_tier || "premium").toLowerCase();
      const TIER_RANK: Record<string, number> = { free: 1, premium: 2, family: 3 };
      const currentTier = (family.subscription_tier || "free").toLowerCase();

      // Controllo A: Regalo abbonamento già attivo e non ancora scaduto
      if (family.gift_subscription_expires_at && new Date(family.gift_subscription_expires_at) > new Date()) {
        const dateStr = new Date(family.gift_subscription_expires_at).toLocaleDateString("it-IT");
        return NextResponse.json(
          { error: `Hai già un regalo abbonamento attivo fino al ${dateStr}, riscattalo dopo quella data.` },
          { status: 400 }
        );
      }

      // Controllo B: Abbonamento Stripe pagato attivo
      if (family.stripe_subscription_id && family.subscription_status === "active") {
        if ((TIER_RANK[tierToApply] || 1) <= (TIER_RANK[currentTier] || 1)) {
          return NextResponse.json(
            {
              error: `Hai già un abbonamento pagato ${currentTier.toUpperCase()} attivo (pari o superiore al regalo ${tierToApply.toUpperCase()}). Il regalo non è applicabile al tuo profilo, ma il codice non è stato consumato e puoi regalarlo a un'altra famiglia.`,
            },
            { status: 400 }
          );
        }
      }

      const preGiftTier = currentTier;
      const durationMonths = gift.duration_months || 1;
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

      // Aggiorna la famiglia con il nuovo tier regalato per 1 mese
      await adminClient
        .from("families")
        .update({
          subscription_tier: tierToApply,
          subscription_status: "active",
          gift_subscription_expires_at: expiresAt.toISOString(),
          pre_gift_tier: preGiftTier,
        })
        .eq("id", family.id);

      await reactivateSuspendedChildrenOnUpgrade(adminClient, family.id);

      // Accredito dei monthly_credits (NON welcome_credits)
      const planData = await getSubscriptionPlan(tierToApply, adminClient);
      const monthlyCredits = planData.monthlyCredits || 0;
      if (monthlyCredits > 0) {
        await adminClient
          .from("families")
          .update({ credits_balance: (family.credits_balance || 0) + monthlyCredits })
          .eq("id", family.id);

        await adminClient.from("credit_ledger").insert({
          family_id: family.id,
          amount: monthlyCredits,
          transaction_type: "GIFT_REDEMPTION",
          description: `Riscatto regalo abbonamento ${tierToApply.toUpperCase()} — +${monthlyCredits} crediti mensili`,
        });
      }
    } else {
      return NextResponse.json({ error: "Tipo di codice regalo non riconosciuto" }, { status: 400 });
    }

    // 3. Marca il codice come riscattato
    const nowIso = new Date().toISOString();
    await adminClient
      .from("gift_codes")
      .update({
        status: "redeemed",
        redeemed_by_family_id: family.id,
        redeemed_at: nowIso,
      })
      .eq("id", gift.id);

    // 4. Invia notifiche
    try {
      const durationMonths = gift.duration_months || 1;
      const giftDesc = gift.type === "credits" ? `+${gift.amount_or_tier} crediti` : `${durationMonths} mes${durationMonths === 1 ? "e" : "i"} di abbonamento ${gift.amount_or_tier.toUpperCase()}`;
      await notifyFamily({
        familyId: family.id,
        category: "billing",
        title: "Codice Regalo Riscattato! 🎉",
        message: `Hai riscattato con successo il codice regalo (${giftDesc}). Buona navigazione su StoriIA!`,
        actionLink: "/billing",
      });

      if (gift.purchased_by_family_id !== family.id) {
        await notifyFamily({
          familyId: gift.purchased_by_family_id,
          category: "billing",
          title: "Il tuo regalo è stato riscattato! 🎁",
          message: `Il codice regalo ${gift.code} che hai acquistato è stato appena riscattato da una famiglia felice!`,
          actionLink: "/billing",
        });
      }
    } catch (err) {
      console.error("[redeem-gift] Errore invio notifiche:", err instanceof Error ? err.message : "errore sconosciuto");
    }

    return NextResponse.json({
      success: true,
      code: gift.code,
      type: gift.type,
      amountOrTier: gift.amount_or_tier,
      durationMonths: gift.duration_months || 1,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore durante il riscatto del codice regalo";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
