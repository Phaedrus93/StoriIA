import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_LIMITS, type SubscriptionTier } from "@/lib/config";
import { notifyFamily } from "@/lib/notifications";

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
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } else {
      // Modalità dev: accetta payload non firmati
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
          const monthlyCredits = PLAN_LIMITS[newTier]?.monthlyCredits ?? 0;
          await adminClient.from("families")
            .update({ subscription_tier: newTier, subscription_status: "active" })
            .eq("id", familyId);
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
            .from("families").select("addon_children_count").eq("id", familyId).single();
          await adminClient.from("families")
            .update({ addon_children_count: (fam?.addon_children_count || 0) + 1 })
            .eq("id", familyId);
          await notifyFamily({
            familyId,
            category: "billing",
            title: "Slot Bambino Add-on Aggiunto! 👶",
            message: "Hai sbloccato 1 profilo bambino aggiuntivo per il tuo account famiglia.",
            actionLink: "/children",
          });
        } else if (purchaseType === "narrative_content") {
          const contentId = session.metadata?.content_id;
          if (contentId) {
            await adminClient.from("family_unlocked_content").upsert({
              family_id: familyId,
              content_id: contentId,
              unlocked_via: "purchase",
              stripe_session_id: session.id,
            }, { onConflict: "family_id,content_id" });
            await notifyFamily({
              familyId,
              category: "activity",
              title: "Contenuto Narrativo Sbloccato! ✨",
              message: "Il nuovo tratto/ambientazione è ora disponibile nella creazione delle tue prossime storie.",
              actionLink: "/stories/new",
            });
          }
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
            .select("credits_balance, subscription_tier")
            .eq("id", familyId)
            .single();
          if (fam) {
            const tier = (fam.subscription_tier || "free") as SubscriptionTier;
            const monthlyCredits = PLAN_LIMITS[tier]?.monthlyCredits ?? 0;
            if (monthlyCredits > 0) {
              await adminClient.from("families")
                .update({
                  credits_balance: (fam.credits_balance || 0) + monthlyCredits,
                  subscription_status: "active",
                })
                .eq("id", familyId);
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

    return NextResponse.json({ received: true, type: event.type });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore elaborazione webhook";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
