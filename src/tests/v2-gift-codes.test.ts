import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { checkAndExpireGiftSubscription } from "@/lib/billing-utils";
import { POST as redeemGiftRoute } from "@/app/api/billing/redeem-gift/route";

let currentMockUser: { id: string; email: string } | null = null;
let db: PGlite;

const buyerParentId = "b1111111-1111-1111-1111-111111111111";
const redeemerParentId = "c2222222-2222-2222-2222-222222222222";
const buyerFamilyId = "fb111111-1111-1111-1111-111111111111";
const redeemerFamilyId = "fc222222-2222-2222-2222-222222222222";

vi.mock("@/lib/notifications", () => ({
  notifyFamily: vi.fn(async () => {}),
}));

// Mock Supabase Server e Admin adapters per PGlite
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: currentMockUser },
        error: currentMockUser ? null : { message: "Non autenticato" },
      }),
    },
    from: (table: string) => makeQueryBuilder(table),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => makeQueryBuilder(table),
  }),
}));

function makeQueryBuilder(table: string) {
  let filters: Record<string, any> = {};
  let orderCol: string | null = null;
  let orderAsc: boolean = true;
  let colsToSelect: string = "*";

  const chain: any = {
    select: (cols: string = "*") => {
      colsToSelect = cols;
      return chain;
    },
    eq: (col: string, val: any) => {
      filters[col] = val;
      return chain;
    },
    order: (col: string, opts?: { ascending: boolean }) => {
      orderCol = col;
      orderAsc = opts?.ascending ?? true;
      return chain;
    },
    single: async () => {
      try {
        const whereParts = Object.entries(filters).map(([k, v]) => `${k} = '${v}'`);
        const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
        const res = await db.query(`SELECT ${colsToSelect} FROM public.${table} ${whereClause} LIMIT 1`);
        return { data: res.rows[0] || null, error: res.rows[0] ? null : { message: "Not found" } };
      } catch (err: any) {
        return { data: null, error: err };
      }
    },
    async then(resolve: any, reject?: any) {
      try {
        const whereParts = Object.entries(filters).map(([k, v]) => `${k} = '${v}'`);
        const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
        const orderClause = orderCol ? `ORDER BY ${orderCol} ${orderAsc ? "ASC" : "DESC"}` : "";
        const res = await db.query(`SELECT ${colsToSelect} FROM public.${table} ${whereClause} ${orderClause}`);
        resolve({ data: res.rows, error: null });
      } catch (err: any) {
        resolve({ data: null, error: err });
      }
    },
    insert: async (records: any) => {
      try {
        const arr = Array.isArray(records) ? records : [records];
        for (const rec of arr) {
          const cols = Object.keys(rec);
          const vals = Object.values(rec).map((v) => {
            if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
            if (v === null || v === undefined) return "NULL";
            if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
            return v;
          });
          await db.query(`INSERT INTO public.${table} (${cols.join(", ")}) VALUES (${vals.join(", ")})`);
        }
        return { data: arr, error: null };
      } catch (err: any) {
        console.error(`Mock insert error on table ${table}:`, err);
        return { data: null, error: err };
      }
    },
    update: (updates: Record<string, any>) => ({
      eq: async (col: string, val: any) => {
        try {
          const setParts = Object.entries(updates).map(([k, v]) => {
            if (typeof v === "string") return `${k} = '${v.replace(/'/g, "''")}'`;
            if (v === null || v === undefined) return `${k} = NULL`;
            if (typeof v === "object") return `${k} = '${JSON.stringify(v).replace(/'/g, "''")}'`;
            return `${k} = ${v}`;
          });
          await db.query(`UPDATE public.${table} SET ${setParts.join(", ")} WHERE ${col} = '${val}'`);
          return { error: null };
        } catch (err: any) {
          console.error(`Mock update.eq error on table ${table}:`, err);
          return { error: err };
        }
      },
      in: async (col: string, vals: any[]) => {
        try {
          const setParts = Object.entries(updates).map(([k, v]) => {
            if (typeof v === "string") return `${k} = '${v.replace(/'/g, "''")}'`;
            if (v === null || v === undefined) return `${k} = NULL`;
            return `${k} = ${v}`;
          });
          const inList = vals.map((v) => (typeof v === "string" ? `'${v}'` : v)).join(", ");
          await db.query(`UPDATE public.${table} SET ${setParts.join(", ")} WHERE ${col} IN (${inList})`);
          return { error: null };
        } catch (err: any) {
          console.error(`Mock update.in error on table ${table}:`, err);
          return { error: err };
        }
      },
    }),
  };
  return chain;
}

describe("V2 Phase 6: Gift Codes (Regalo Crediti e Abbonamento)", () => {
  beforeAll(async () => {
    db = new PGlite();

    await db.exec(`
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE service_role NOLOGIN;
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT);

      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;

      CREATE OR REPLACE FUNCTION auth.jwt()
      RETURNS JSONB
      LANGUAGE sql STABLE AS $$
        SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
      $$;
    `);

    // Caricamento schemi SQL e migrazioni
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/01_mvp_schema.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/04_v1_phase2_billing_and_credits.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260712120000_v1_bugfixes_schema.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260718000000_v2_phase4_admin_panel_and_subscription_plans.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260719000000_v2_phase6_gift_codes.sql"), "utf-8"));

    // Creazione utenti mock in auth.users
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${buyerParentId}', 'buyer@example.com');
      INSERT INTO auth.users (id, email) VALUES ('${redeemerParentId}', 'redeemer@example.com');
    `);

    // Creazione famiglie
    await db.exec(`
      INSERT INTO public.families (id, parent_user_id, subscription_tier, subscription_status, credits_balance)
      VALUES ('${buyerFamilyId}', '${buyerParentId}', 'premium', 'active', 50);

      INSERT INTO public.families (id, parent_user_id, subscription_tier, subscription_status, credits_balance)
      VALUES ('${redeemerFamilyId}', '${redeemerParentId}', 'free', 'active', 3);
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("1. Riscatto codice regalo 'credits' aggiunge crediti alla famiglia e marca il codice come redeemed", async () => {
    // Inserisci codice regalo crediti in status active
    await db.query(`
      INSERT INTO public.gift_codes (id, code, type, amount_or_tier, purchased_by_family_id, status)
      VALUES ('c0000001-0000-0000-0000-000000000001', 'GIFT-CRED-1000', 'credits', '25', '${buyerFamilyId}', 'active');
    `);

    currentMockUser = { id: redeemerParentId, email: "redeemer@example.com" };
    const req = new Request("http://localhost:3000/api/billing/redeem-gift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "GIFT-CRED-1000" }),
    });

    const res = await redeemGiftRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // Verifica saldo crediti su DB (3 + 25 = 28)
    const famRes = await db.query(`SELECT credits_balance FROM public.families WHERE id = '${redeemerFamilyId}'`);
    expect(famRes.rows[0].credits_balance).toBe(28);

    // Verifica stato codice regalo su DB
    const giftRes = await db.query(`SELECT status, redeemed_by_family_id FROM public.gift_codes WHERE code = 'GIFT-CRED-1000'`);
    expect(giftRes.rows[0].status).toBe("redeemed");
    expect(giftRes.rows[0].redeemed_by_family_id).toBe(redeemerFamilyId);

    // Verifica transazione su credit_ledger
    const ledgerRes = await db.query(`SELECT amount, transaction_type FROM public.credit_ledger WHERE family_id = '${redeemerFamilyId}' AND transaction_type = 'GIFT_REDEMPTION'`);
    expect(ledgerRes.rows[0].amount).toBe(25);
  });

  it("2. Riscatto codice regalo 'subscription' (es. family) aggiorna tier, imposta scadenza a +1 mese e accredita SOLO i monthly_credits", async () => {
    // Inserisci codice regalo abbonamento in status active
    await db.query(`
      INSERT INTO public.gift_codes (id, code, type, amount_or_tier, purchased_by_family_id, status)
      VALUES ('c0000002-0000-0000-0000-000000000002', 'GIFT-SUBS-FAM1', 'subscription', 'family', '${buyerFamilyId}', 'active');
    `);

    currentMockUser = { id: redeemerParentId, email: "redeemer@example.com" };
    const req = new Request("http://localhost:3000/api/billing/redeem-gift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "GIFT-SUBS-FAM1" }),
    });

    const res = await redeemGiftRoute(req);
    expect(res.status).toBe(200);

    // Verifica che subscription_tier = 'family', pre_gift_tier = 'free'
    const famRes = await db.query(`SELECT subscription_tier, pre_gift_tier, gift_subscription_expires_at, credits_balance FROM public.families WHERE id = '${redeemerFamilyId}'`);
    expect(famRes.rows[0].subscription_tier).toBe("family");
    expect(famRes.rows[0].pre_gift_tier).toBe("free");
    expect(famRes.rows[0].gift_subscription_expires_at).not.toBeNull();

    // Verifica che siano stati accreditati i monthly_credits (80 per family secondo subscription_plans)
    // Prima era 28, ora deve essere 28 + 80 = 108
    expect(famRes.rows[0].credits_balance).toBe(108);
  });

  it("3. Rifiuta il riscatto di un secondo regalo abbonamento se uno è già attivo e nel futuro (senza consumare il codice)", async () => {
    // Inserisci un altro codice regalo abbonamento
    await db.query(`
      INSERT INTO public.gift_codes (id, code, type, amount_or_tier, purchased_by_family_id, status)
      VALUES ('c0000003-0000-0000-0000-000000000003', 'GIFT-SUBS-PREM', 'subscription', 'premium', '${buyerFamilyId}', 'active');
    `);

    currentMockUser = { id: redeemerParentId, email: "redeemer@example.com" };
    const req = new Request("http://localhost:3000/api/billing/redeem-gift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "GIFT-SUBS-PREM" }),
    });

    const res = await redeemGiftRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Hai già un regalo abbonamento attivo fino al");

    // Verifica fondamentale: il codice non deve essere stato consumato e deve rimanere 'active'
    const giftRes = await db.query(`SELECT status, redeemed_by_family_id FROM public.gift_codes WHERE code = 'GIFT-SUBS-PREM'`);
    expect(giftRes.rows[0].status).toBe("active");
    expect(giftRes.rows[0].redeemed_by_family_id).toBeNull();
  });

  it("4. Rifiuta il riscatto se l'utente ha già un abbonamento pagato Stripe di tier pari o superiore (senza consumare il codice)", async () => {
    // Impostiamo il buyer che ha già abbonamento pagato Premium attivo via Stripe
    await db.query(`
      UPDATE public.families
      SET stripe_subscription_id = 'sub_live_12345', subscription_tier = 'premium', subscription_status = 'active'
      WHERE id = '${buyerFamilyId}'
    `);

    currentMockUser = { id: buyerParentId, email: "buyer@example.com" };
    const req = new Request("http://localhost:3000/api/billing/redeem-gift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "GIFT-SUBS-PREM" }),
    });

    const res = await redeemGiftRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Hai già un abbonamento pagato");

    // Verifica fondamentale: il codice resta 'active' e non consumato
    const giftRes = await db.query(`SELECT status FROM public.gift_codes WHERE code = 'GIFT-SUBS-PREM'`);
    expect(giftRes.rows[0].status).toBe("active");
  });

  it("5. checkAndExpireGiftSubscription ripristina il tier al pre_gift_tier ('free'), imposta status a 'canceled', e sospende i profili bambino eccedenti", async () => {
    // Creiamo 4 profili bambino per redeemerFamilyId (che ora ha tier family ma quando scade torna a free il cui limite è 1)
    await db.query(`
      INSERT INTO public.child_profiles (id, family_id, name, birth_year, is_suspended, created_at) VALUES
      ('ca000001-0000-0000-0000-000000000001', '${redeemerFamilyId}', 'Bimbo1', 2019, false, '2026-07-01 10:00:00+00'),
      ('ca000002-0000-0000-0000-000000000002', '${redeemerFamilyId}', 'Bimbo2', 2018, false, '2026-07-02 10:00:00+00'),
      ('ca000003-0000-0000-0000-000000000003', '${redeemerFamilyId}', 'Bimbo3', 2017, false, '2026-07-03 10:00:00+00'),
      ('ca000004-0000-0000-0000-000000000004', '${redeemerFamilyId}', 'Bimbo4', 2016, false, '2026-07-04 10:00:00+00');
    `);

    // Simuliamo la scadenza temporale portando gift_subscription_expires_at nel passato
    const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
    await db.query(`
      UPDATE public.families
      SET gift_subscription_expires_at = '${pastDate}'
      WHERE id = '${redeemerFamilyId}'
    `);

    // Chiamiamo checkAndExpireGiftSubscription
    const adminClient = {
      from: (table: string) => makeQueryBuilder(table),
    };

    const result = await checkAndExpireGiftSubscription(adminClient, redeemerFamilyId);
    expect(result.expired).toBe(true);
    expect(result.newTier).toBe("free");

    // Verifica su DB che la famiglia sia tornata a 'free' con status 'canceled' (essendo free senza stripe sub attiva)
    const famRes = await db.query(`SELECT subscription_tier, subscription_status, gift_subscription_expires_at, pre_gift_tier FROM public.families WHERE id = '${redeemerFamilyId}'`);
    expect(famRes.rows[0].subscription_tier).toBe("free");
    expect(famRes.rows[0].subscription_status).toBe("canceled");
    expect(famRes.rows[0].gift_subscription_expires_at).toBeNull();
    expect(famRes.rows[0].pre_gift_tier).toBeNull();

    // Verifica che enforceSuspensionOnDowngrade abbia sospeso i profili eccedenti (Bimbo2, Bimbo3, Bimbo4 sospesi; Bimbo1 rimane attivo)
    const activeChildrenRes = await db.query(`SELECT count(*) as active_cnt FROM public.child_profiles WHERE family_id = '${redeemerFamilyId}' AND is_suspended = false`);
    expect(Number(activeChildrenRes.rows[0].active_cnt)).toBe(1);

    const suspendedChildrenRes = await db.query(`SELECT count(*) as susp_cnt FROM public.child_profiles WHERE family_id = '${redeemerFamilyId}' AND is_suspended = true`);
    expect(Number(suspendedChildrenRes.rows[0].susp_cnt)).toBe(3);
  });
});
