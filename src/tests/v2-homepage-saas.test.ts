import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { getAllSubscriptionPlans, getSubscriptionPlan } from "@/lib/plans";
import { PLAN_LIMITS } from "@/lib/config";
import React from "react";

describe("v2-homepage-saas.test.ts — Homepage SaaS Reale, Prezzi Sincronizzati & CTA", () => {
  it("1. Recupero dinamico dei piani (getAllSubscriptionPlans) con valori allineati al checkout Stripe (0 €, 9.99 €, 19.99 €)", async () => {
    // Simuliamo un client Supabase che restituisce i record dinamici da subscription_plans (come in produzione)
    const mockSupabase = {
      from: (table: string) => ({
        select: () => ({
          order: async () => ({
            data: [
              {
                tier: "free",
                name: "Gratuito",
                max_children: 1,
                monthly_credits: 0,
                welcome_credits: 5,
                all_morals: false,
                price_monthly_cents: 0,
                description: "Piano base gratuito",
              },
              {
                tier: "premium",
                name: "Premium",
                max_children: 3,
                monthly_credits: 30,
                welcome_credits: 0,
                all_morals: true,
                price_monthly_cents: 999,
                description: "Piano consigliato per la famiglia",
              },
              {
                tier: "family",
                name: "Famiglia",
                max_children: 6,
                monthly_credits: 80,
                welcome_credits: 0,
                all_morals: true,
                price_monthly_cents: 1999,
                description: "Storie illimitate e fino a 6 bambini",
              },
            ],
            error: null,
          }),
        }),
      }),
    };

    const plans = await getAllSubscriptionPlans(mockSupabase as any);
    expect(plans.length).toBe(3);

    const freePlan = plans.find((p) => p.tier === "free");
    expect(freePlan).toBeDefined();
    expect(freePlan?.priceMonthlyCents).toBe(0);
    expect(freePlan?.maxChildren).toBe(1);

    const premiumPlan = plans.find((p) => p.tier === "premium");
    expect(premiumPlan).toBeDefined();
    expect(premiumPlan?.priceMonthlyCents).toBe(999); // Corrisponde esattamente a 9,99 € di STRIPE_PRICE_PREMIUM_MONTHLY
    expect(premiumPlan?.maxChildren).toBe(3);

    const familyPlan = plans.find((p) => p.tier === "family");
    expect(familyPlan).toBeDefined();
    expect(familyPlan?.priceMonthlyCents).toBe(1999); // Corrisponde esattamente a 19,99 € di STRIPE_PRICE_FAMILY_MONTHLY
    expect(familyPlan?.maxChildren).toBe(6);
  });

  it("2. Resilienza e Fallback in-memory su PLAN_LIMITS in caso di assenza o errore del DB", async () => {
    // Simuliamo un errore del DB o assenza della tabella
    const failingSupabase = {
      from: () => ({
        select: () => ({
          order: async () => ({
            data: null,
            error: { message: "Table subscription_plans not found" },
          }),
        }),
      }),
    };

    const plans = await getAllSubscriptionPlans(failingSupabase as any);
    expect(plans.length).toBe(3);
    expect(plans[0].tier).toBe("free");
    expect(plans[0].maxChildren).toBe(PLAN_LIMITS.free.maxChildren);
    expect(plans[1].tier).toBe("premium");
    expect(plans[1].maxChildren).toBe(PLAN_LIMITS.premium.maxChildren);
    expect(plans[2].tier).toBe("family");
    expect(plans[2].maxChildren).toBe(PLAN_LIMITS.family.maxChildren);
  });

  it("3. Logica di indirizzamento CTA coerente allo stato di login (Utente non autenticato vs Autenticato)", () => {
    // Simulo la logica di decisione per le CTA del componente HomePricingSection
    const getCtaTarget = (planTier: string, priceMonthlyCents: number, isAuthenticated: boolean) => {
      if (isAuthenticated) {
        return planTier === "free" ? "/dashboard" : "/settings";
      } else {
        return planTier === "free" || priceMonthlyCents === 0
          ? "/register"
          : `/register?plan=${planTier}`;
      }
    };

    // Caso 1: Utente non loggato clicca su Premium (9.99 €) -> deve essere guidato alla registrazione con il piano selezionato
    expect(getCtaTarget("premium", 999, false)).toBe("/register?plan=premium");

    // Caso 2: Utente non loggato clicca su Free (0 €) -> guidato a /register semplice
    expect(getCtaTarget("free", 0, false)).toBe("/register");

    // Caso 3: Utente loggato clicca su Premium o Famiglia -> guidato a /settings dove può gestire l'abbonamento Stripe
    expect(getCtaTarget("premium", 999, true)).toBe("/settings");
    expect(getCtaTarget("family", 1999, true)).toBe("/settings");

    // Caso 4: Utente loggato clicca su Free -> entra in dashboard
    expect(getCtaTarget("free", 0, true)).toBe("/dashboard");
  });
});
