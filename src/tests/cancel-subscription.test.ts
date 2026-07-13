import { describe, it, expect, vi, beforeEach } from "vitest";

const { subscriptionsUpdateMock } = vi.hoisted(() => ({
  subscriptionsUpdateMock: vi.fn().mockResolvedValue({ id: "sub_123", cancel_at_period_end: true }),
}));

vi.mock("stripe", () => {
  return {
    default: class StripeMock {
      subscriptions = {
        update: subscriptionsUpdateMock,
      };
    },
  };
});

import { POST as cancelSubscriptionPOST } from "@/app/api/billing/cancel-subscription/route";
import { POST as reactivateSubscriptionPOST } from "@/app/api/billing/reactivate-subscription/route";

// Mock del server Supabase client
const updateMock = vi.fn().mockReturnThis();
const eqMock = vi.fn().mockResolvedValue({ error: null });
let fakeFamilyData: any = {
  id: "fam_123",
  subscription_tier: "premium",
  subscription_status: "active",
  stripe_subscription_id: "sub_stripe_abc123",
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: "user_parent_123" } },
        error: null,
      }),
    },
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: fakeFamilyData, error: null }),
        }),
      }),
      update: (payload: any) => {
        updateMock(payload);
        return {
          eq: eqMock,
        };
      },
    }),
  }),
}));

describe("StoriIA — Verifica Cancellazione e Riattivazione Abbonamento Stripe & DB Locale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeFamilyData = {
      id: "fam_123",
      subscription_tier: "premium",
      subscription_status: "active",
      stripe_subscription_id: "sub_stripe_abc123",
    };
  });

  it("deve chiamare stripe.subscriptions.update con cancel_at_period_end: true e poi aggiornare subscription_status sul DB locale", async () => {
    const req = new Request("http://localhost/api/billing/cancel-subscription", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await cancelSubscriptionPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe("canceling_at_period_end");

    // Verifica che l'API Stripe sia stata chiamata davvero con cancel_at_period_end: true
    expect(subscriptionsUpdateMock).toHaveBeenCalledTimes(1);
    expect(subscriptionsUpdateMock).toHaveBeenCalledWith("sub_stripe_abc123", {
      cancel_at_period_end: true,
    });

    // Verifica che l'aggiornamento DB locale sia avvenuto
    expect(updateMock).toHaveBeenCalledWith({
      subscription_status: "canceling_at_period_end",
    });
  });

  it("NON deve aggiornare il DB locale se la chiamata a Stripe fallisce", async () => {
    subscriptionsUpdateMock.mockRejectedValueOnce(new Error("Stripe network error"));

    const req = new Request("http://localhost/api/billing/cancel-subscription", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await cancelSubscriptionPOST(req);
    const data = await res.json();

    expect(res.status).toBe(502);
    expect(data.error).toContain("Impossibile cancellare l'abbonamento su Stripe");

    // Verifica che updateMock del DB NON sia stato chiamato dopo il fallimento di Stripe
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("deve permettere di riattivare l'abbonamento chiamando stripe.subscriptions.update con cancel_at_period_end: false", async () => {
    fakeFamilyData.subscription_status = "canceling_at_period_end";

    const res = await reactivateSubscriptionPOST();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.status).toBe("active");

    // Verifica che Stripe sia stato chiamato per disattivare la cancellazione
    expect(subscriptionsUpdateMock).toHaveBeenCalledWith("sub_stripe_abc123", {
      cancel_at_period_end: false,
    });

    // Verifica che il DB locale sia tornato 'active'
    expect(updateMock).toHaveBeenCalledWith({
      subscription_status: "active",
    });
  });
});
