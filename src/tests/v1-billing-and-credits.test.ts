import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/stripe/webhook/route";

// Mock del client admin Supabase utilizzato all'interno dell'handler del webhook
const updateMock = vi.fn().mockReturnThis();
const eqMock = vi.fn().mockReturnThis();
const inMock = vi.fn().mockResolvedValue({ error: null });
const orderMock = vi.fn().mockResolvedValue({ data: [] });
const insertMock = vi.fn().mockResolvedValue({ error: null });
const selectMock = vi.fn().mockReturnThis();
const singleMock = vi.fn().mockResolvedValue({
  data: { credits_balance: 5, subscription_tier: "free", addon_children_count: 0 },
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      update: updateMock,
      eq: eqMock,
      in: inMock,
      order: orderMock,
      insert: insertMock,
      select: selectMock,
      single: singleMock,
      upsert: insertMock,
    }),
  }),
}));

vi.mock("@/lib/notifications", () => ({
  notifyFamily: vi.fn().mockResolvedValue(true),
}));

describe("StoriIA v1.2 - Real Stripe Webhook Handler Verification (src/app/api/stripe/webhook/route.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("deve elaborare correttamente l'evento checkout.session.completed per abbonamento aggiornando il tier della famiglia", async () => {
    const fakeEvent = {
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_123",
          metadata: {
            family_id: "fam_test_123",
            purchase_type: "subscription",
            plan_tier: "family",
          },
          customer: "cus_test_123",
          subscription: "sub_test_123",
        },
      },
    };

    const req = new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fakeEvent),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_tier: "family",
        subscription_status: "active",
        stripe_customer_id: "cus_test_123",
        stripe_subscription_id: "sub_test_123",
      })
    );
  });

  it("deve elaborare correttamente l'evento invoice.payment_failed mettendo la famiglia in stato 'frozen'", async () => {
    const fakeEvent = {
      type: "invoice.payment_failed",
      data: {
        object: {
          id: "in_test_123",
          metadata: {
            family_id: "fam_test_123",
          },
        },
      },
    };

    const req = new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fakeEvent),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_status: "frozen",
      })
    );
  });

  it("deve elaborare correttamente l'evento customer.subscription.deleted riportando il tier a 'free' e 'canceled'", async () => {
    const fakeEvent = {
      type: "customer.subscription.deleted",
      data: {
        object: {
          id: "sub_test_123",
          metadata: {
            family_id: "fam_test_123",
          },
        },
      },
    };

    const req = new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fakeEvent),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subscription_tier: "free",
        subscription_status: "canceled",
      })
    );
  });

  it("deve rifiutare OBBLIGATORIAMENTE le richieste senza firma o con firma non valida in NODE_ENV=production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const fakeEvent = { type: "checkout.session.completed", data: { object: {} } };
    const req = new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fakeEvent),
    });

    const res = await POST(req);
    expect(res.status).not.toBe(200);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });
});
