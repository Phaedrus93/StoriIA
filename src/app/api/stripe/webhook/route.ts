import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_LIMITS, APP_CONFIG, type SubscriptionTier } from "@/lib/config";
import { getSubscriptionPlan } from "@/lib/plans";
import { notifyFamily } from "@/lib/notifications";
import { enforceSuspensionOnDowngrade } from "@/lib/billing-utils";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2026-06-24.dahlia",
});

/**
 * Webhook Stripe verificato con firma.
 * Eventi gestiti:
 * - checkout.session.completed  → aggiorna piano / aggiunge crediti / sblocca contenuti / add-on bambino
 * - invoice.payment_succeeded   → aggiunge crediti mensili inclusi nel piano
 * - invoice.payment_failed      → sospende abbonamento (frozen)
 * - customer.subscription.deleted → torna a free
 */
export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  let event: Stripe.Event;

  try {
    if (process.env.NODE_ENV === "production") {
      if (!webhookSecret) {
        return NextResponse.json(
          { error: "STRIPE_WEBHOOK_SECRET non configurato in produzione" },
          { status: 500 }
        );
      }
      if (!signature) {
        return NextResponse.json(
          { error: "Header stripe-signature mancante in produzione" },
          { status: 400 }
        );
      }
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } else if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } else {
      // Modalità di sviluppo locale non-prod
      console.warn("[Stripe Webhook] Attenzione: payload non firmato accettato in ambiente non-production");
      event = JSON.parse(rawBody) as Stripe.Event;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Firma webhook non valida";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const data = event.data.object as Stripe.Checkout.Session | Stripe.Invoice | Stripe.Subscription;

  // Estrae family_id dai metadata (checkout.session o subscription)
  const sessionData = data as Stripe.Checkout.Session;
  const subData = data as Stripe.Subscription;
  const meta: Record<string, string> =
    (sessionData.metadata ?? subData.metadata ?? {}) as Record<string, string>;
  const familyId = meta.family_id;

  if (!familyId) {
    return NextResponse.json({ received: true, skipped: "no_family_id" });
  }

  // ─── Controllo Idempotenza PRIMA di processare ─────────────────────────────
  const { data: existingEvent } = await adminClient
    .from("stripe_webhook_events")
    .select("event_id, status")
    .eq("event_id", event.id)
    .single();

  if (existingEvent && existingEvent.status === "processed") {
    return NextResponse.json({ received: true, idempotent: true, alreadyProcessed: true });
  }

  // Registrazione riga 'received' all'inizio
  await adminClient.from("stripe_webhook_events").upsert({
    event_id: event.id,
    event_type: event.type,
    family_id: familyId,
    status: "received",
    payload: event as unknown as Record<string, unknown>,
    created_at: new Date().toISOString(),
  });

  try {
    switch (event.type) {
      // ─── Checkout completato ───────────────────────────────────────────────
      case "checkout.session.completed": {
        const session = data as Stripe.Checkout.Session;
        const purchaseType = session.metadata?.purchase_type;

        if (purchaseType === "credit_pack") {
          const creditsToAdd = Number(session.metadata?.credits_amount || 10);
          const { data: fam } = await adminClient
            .from("families").select("credits_balance").eq("id", familyId).single();
          if (fam) {
            await adminClient.from("families")
              .update({ credits_balance: (fam.credits_balance || 0) + creditsToAdd })
              .eq("id", familyId);
            await adminClient.from("credit_ledger").insert({
              family_id: familyId,
              amount: creditsToAdd,
              transaction_type: "CREDIT_PACK_PURCHASE",
              description: `Pacchetto +${creditsToAdd} storie AI via Stripe`,
            });
            await notifyFamily({
              familyId,
              category: "credits",
              title: "Pacchetto crediti accreditato! ⚡",
              message: `Hai acquistato con successo +${creditsToAdd} crediti AI per le tue favole. Buona lettura!`,
              actionLink: "/billing",
            });
          }
        } else if (purchaseType === "subscription") {
          const newTier = (session.metadata?.plan_tier || "premium") as SubscriptionTier;
          const planData = await getSubscriptionPlan(newTier, adminClient);
          const monthlyCredits = planData.monthlyCredits;
          const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id || null;
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;

          await adminClient.from("families")
            .update({
              subscription_tier: newTier,
              subscription_status: "active",
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
            })
            .eq("id", familyId);

          await enforceSuspensionOnDowngrade(adminClient, familyId, newTier);
          if (monthlyCredits > 0) {
            const { data: fam } = await adminClient
              .from("families").select("credits_balance").eq("id", familyId).single();
            await adminClient.from("families")
              .update({ credits_balance: (fam?.credits_balance || 0) + monthlyCredits })
              .eq("id", familyId);
            await adminClient.from("credit_ledger").insert({
              family_id: familyId,
              amount: monthlyCredits,
              transaction_type: "SUBSCRIPTION_RENEWAL",
              description: `Rinnovo abbonamento ${newTier.toUpperCase()} — ${monthlyCredits} crediti mensili`,
            });
          }
          await notifyFamily({
            familyId,
            category: "billing",
            title: `Piano ${newTier.toUpperCase()} Attivato con successo! 🎉`,
            message: `Il tuo abbonamento è ora attivo. Hai ricevuto ${monthlyCredits} crediti mensili e accesso a tutte le funzionalità ${newTier.toUpperCase()}.`,
            actionLink: "/billing",
          });
        } else if (purchaseType === "addon_child") {
          const { data: fam } = await adminClient
            .from("families").select("addon_children_count, subscription_tier").eq("id", familyId).single();
          const currentAddons = fam?.addon_children_count || 0;
          const currentTier = (fam?.subscription_tier || "free") as SubscriptionTier;
          const planData = await getSubscriptionPlan(currentTier, adminClient);
          const addonMax = planData.addonMaxPerFamily || APP_CONFIG.addonChildren.maxPerFamily;
          if (currentAddons >= addonMax) {
            return NextResponse.json(
              { error: `Tetto massimo di profili add-on (${addonMax}) già raggiunto per questa famiglia.` },
              { status: 400 }
            );
          }
          await adminClient.from("families")
            .update({ addon_children_count: currentAddons + 1 })
            .eq("id", familyId);
          await notifyFamily({
            familyId,
            category: "billing",
            title: "Slot Bambino Add-on Aggiunto! 👶",
            message: "Hai sbloccato 1 profilo bambino aggiuntivo per il tuo account famiglia.",
            actionLink: "/children",
          });
        }
        break;
      }

      // ─── Rinnovo abbonamento ───────────────────────────────────────────────
      case "invoice.payment_succeeded": {
        const invoice = data as Stripe.Invoice;
        // Solo per rinnovi (non il primo pagamento, già gestito da checkout.session.completed)
        if (invoice.billing_reason === "subscription_cycle") {
          const { data: fam } = await adminClient
            .from("families")
            .select("credits_balance, subscription_tier, addon_children_count, pending_addon_children_count")
            .eq("id", familyId)
            .single();
          if (fam) {
            const tier = (fam.subscription_tier || "free") as SubscriptionTier;
            const planData = await getSubscriptionPlan(tier, adminClient);
            const monthlyCredits = planData.monthlyCredits;
            const updates: Record<string, any> = {
              subscription_status: "active",
            };
            if (monthlyCredits > 0) {
              updates.credits_balance = (fam.credits_balance || 0) + monthlyCredits;
            }
            if (fam.pending_addon_children_count !== null && fam.pending_addon_children_count !== undefined) {
              updates.addon_children_count = fam.pending_addon_children_count;
              updates.pending_addon_children_count = null;
            }

            await adminClient.from("families")
              .update(updates)
              .eq("id", familyId);

            if (fam.pending_addon_children_count !== null && fam.pending_addon_children_count !== undefined) {
              await enforceSuspensionOnDowngrade(adminClient, familyId, tier);
            }

            if (monthlyCredits > 0) {
              await adminClient.from("credit_ledger").insert({
                family_id: familyId,
                amount: monthlyCredits,
                transaction_type: "SUBSCRIPTION_RENEWAL",
                description: `Rinnovo mensile piano ${tier.toUpperCase()} — ${monthlyCredits} crediti`,
              });
              await notifyFamily({
                familyId,
                category: "billing",
                title: "Rinnovo Abbonamento Completato ✅",
                message: `Il tuo piano ${tier.toUpperCase()} è stato rinnovato e sono stati aggiunti ${monthlyCredits} crediti AI.`,
                actionLink: "/billing",
              });
            }
          }
        }
        break;
      }

      // ─── Pagamento fallito → freeze ────────────────────────────────────────
      case "invoice.payment_failed": {
        await adminClient.from("families")
          .update({ subscription_status: "frozen" })
          .eq("id", familyId);
        await notifyFamily({
          familyId,
          category: "billing",
          title: "Addebito Abbonamento Fallito ⚠️",
          message: "Non siamo riusciti a rinnovare il tuo abbonamento. Il piano è temporaneamente sospeso. Aggiorna il metodo di pagamento per sbloccarlo.",
          actionLink: "/billing",
        });
        break;
      }

      // ─── Abbonamento cancellato → torna a free ─────────────────────────────
      case "customer.subscription.deleted": {
        await adminClient.from("families")
          .update({ subscription_tier: "free", subscription_status: "canceled" })
          .eq("id", familyId);
        await enforceSuspensionOnDowngrade(adminClient, familyId, "free");
        await notifyFamily({
          familyId,
          category: "billing",
          title: "Abbonamento Terminato",
          message: "Il tuo abbonamento a pagamento è terminato. Il tuo profilo è tornato al piano Free.",
          actionLink: "/billing",
        });
        break;
      }

      default:
        break;
    }

    await adminClient.from("stripe_webhook_events").update({
      status: "processed",
      processed_at: new Date().toISOString(),
    }).eq("event_id", event.id);

    return NextResponse.json({ received: true, type: event.type });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore elaborazione webhook";
    await adminClient.from("stripe_webhook_events").update({
      status: "failed",
      error_message: message,
    }).eq("event_id", event.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
