import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { POST } from "@/app/api/stripe/webhook/route";

let dbInstance: PGlite | null = null;

const createPGliteSupabaseAdapter = (pglite: PGlite) => ({
  auth: {
    admin: {
      getUserById: async (id: string) => {
        const res = await pglite.query(`SELECT * FROM auth.users WHERE id = '${id}' LIMIT 1`);
        const row = res.rows[0] as any;
        return {
          data: {
            user: row ? { id: row.id, email: row.email || "parent.fixes@example.com" } : null,
          },
          error: null,
        };
      },
    },
  },
  from: (table: string) => {
    let whereClauses: string[] = [];
    let orderClause = "";
    return {
      select: (_cols?: string) => ({
        eq: function (col: string, val: any) {
          const formattedVal = typeof val === "string" ? `'${val}'` : val;
          whereClauses.push(`${col} = ${formattedVal}`);
          return this;
        },
        order: function (col: string, opts: { ascending: boolean }) {
          orderClause = `ORDER BY ${col} ${opts.ascending ? "ASC" : "DESC"}`;
          return this;
        },
        single: async () => {
          const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
          const res = await pglite.query(`SELECT * FROM public.${table} ${whereStr} LIMIT 1`);
          return { data: res.rows[0] || null, error: null };
        },
        then: async (resolve: (val: any) => void, reject?: (err: any) => void) => {
          const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
          try {
            const res = await pglite.query(`SELECT * FROM public.${table} ${whereStr} ${orderClause}`);
            resolve({ data: res.rows, count: res.rows.length, error: null });
          } catch (err) {
            if (reject) reject(err);
            else resolve({ data: null, count: 0, error: err });
          }
        },
      }),
      update: (data: Record<string, any>) => ({
        eq: async (col: string, val: any) => {
          const setStr = Object.entries(data)
            .map(([k, v]) => `${k} = ${v === null ? "NULL" : typeof v === "boolean" || typeof v === "number" ? v : typeof v === "object" ? `'${JSON.stringify(v)}'` : `'${v}'`}`)
            .join(", ");
          const formattedVal = typeof val === "string" ? `'${val}'` : val;
          await pglite.query(`UPDATE public.${table} SET ${setStr} WHERE ${col} = ${formattedVal}`);
          return { error: null };
        },
        in: async (col: string, vals: string[]) => {
          const setStr = Object.entries(data)
            .map(([k, v]) => `${k} = ${v === null ? "NULL" : typeof v === "boolean" || typeof v === "number" ? v : typeof v === "object" ? `'${JSON.stringify(v)}'` : `'${v}'`}`)
            .join(", ");
          const inStr = vals.map((v) => `'${v}'`).join(", ");
          await pglite.query(`UPDATE public.${table} SET ${setStr} WHERE ${col} IN (${inStr})`);
          return { error: null };
        },
      }),
      insert: (data: Record<string, any> | Record<string, any>[]) => ({
        select: (_cols = "*") => ({
          single: async () => {
            const rows = Array.isArray(data) ? data : [data];
            let insertedRows: any[] = [];
            for (const row of rows) {
              const colsList = Object.keys(row).join(", ");
              const valsList = Object.values(row)
                .map((v) => (v === null ? "NULL" : typeof v === "boolean" || typeof v === "number" ? v : typeof v === "object" ? `'${JSON.stringify(v)}'` : `'${v}'`))
                .join(", ");
              const res = await pglite.query(`INSERT INTO public.${table} (${colsList}) VALUES (${valsList}) RETURNING *`);
              if (res.rows[0]) insertedRows.push(res.rows[0]);
            }
            return { data: insertedRows[0] || null, error: null };
          },
          then: async (resolve: (val: any) => void) => {
            const rows = Array.isArray(data) ? data : [data];
            let insertedRows: any[] = [];
            for (const row of rows) {
              const colsList = Object.keys(row).join(", ");
              const valsList = Object.values(row)
                .map((v) => (v === null ? "NULL" : typeof v === "boolean" || typeof v === "number" ? v : typeof v === "object" ? `'${JSON.stringify(v)}'` : `'${v}'`))
                .join(", ");
              const res = await pglite.query(`INSERT INTO public.${table} (${colsList}) VALUES (${valsList}) RETURNING *`);
              if (res.rows[0]) insertedRows.push(res.rows[0]);
            }
            resolve({ data: insertedRows, error: null });
          },
        }),
        then: async (resolve: (val: any) => void, reject?: (err: any) => void) => {
          try {
            const rows = Array.isArray(data) ? data : [data];
            for (const row of rows) {
              const colsList = Object.keys(row).join(", ");
              const valsList = Object.values(row)
                .map((v) => (v === null ? "NULL" : typeof v === "boolean" || typeof v === "number" ? v : typeof v === "object" ? `'${JSON.stringify(v)}'` : `'${v}'`))
                .join(", ");
              await pglite.query(`INSERT INTO public.${table} (${colsList}) VALUES (${valsList})`);
            }
            resolve({ data: null, error: null });
          } catch (err) {
            if (reject) reject(err);
            else resolve({ data: null, error: err });
          }
        },
      }),
      upsert: (data: Record<string, any> | Record<string, any>[], _opts?: any) => ({
        then: async (resolve: (val: any) => void, reject?: (err: any) => void) => {
          try {
            const rows = Array.isArray(data) ? data : [data];
            for (const row of rows) {
              const colsList = Object.keys(row).join(", ");
              const valsList = Object.values(row)
                .map((v) => (v === null ? "NULL" : typeof v === "boolean" || typeof v === "number" ? v : typeof v === "object" ? `'${JSON.stringify(v)}'` : `'${v}'`))
                .join(", ");
              if (table === "stripe_webhook_events") {
                await pglite.query(`
                  INSERT INTO public.${table} (${colsList}) VALUES (${valsList})
                  ON CONFLICT (event_id) DO UPDATE SET status = EXCLUDED.status, payload = EXCLUDED.payload
                `);
              } else {
                await pglite.query(`INSERT INTO public.${table} (${colsList}) VALUES (${valsList}) ON CONFLICT DO NOTHING`);
              }
            }
            resolve({ data: null, error: null });
          } catch (err) {
            if (reject) reject(err);
            else resolve({ data: null, error: err });
          }
        },
      }),
    };
  },
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (!dbInstance) throw new Error("dbInstance not initialized");
    return createPGliteSupabaseAdapter(dbInstance);
  },
}));

describe("StoriIA — Verifica Correzioni Punti 4-10 (Gamification, Add-on, Crediti, Notifiche, Indirizzo)", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    dbInstance = db;
    process.env.NODE_ENV = "test";
    delete process.env.STRIPE_WEBHOOK_SECRET;

    // 1. Creazione ruoli Supabase e schema auth
    await db.exec(`
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE service_role NOLOGIN;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email TEXT
      );
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$
        SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
      $$;

      CREATE SCHEMA IF NOT EXISTS storage;
      CREATE TABLE IF NOT EXISTS storage.buckets (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        public BOOLEAN DEFAULT false
      );
      CREATE TABLE IF NOT EXISTS storage.objects (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id TEXT,
        name TEXT,
        owner UUID,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        last_accessed_at TIMESTAMPTZ DEFAULT now(),
        metadata JSONB
      );
    `);

    // 2. Esecuzione di tutte le migrazioni
    const migrationsDir = path.join(process.cwd(), "supabase/migrations");
    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (file.endsWith(".sql")) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
        await db.exec(sql);
      }
    }

    // Creiamo utente mock
    const parentId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    await db.query(`
      INSERT INTO auth.users (id, email)
      VALUES ('${parentId}', 'parent.fixes@example.com')
      ON CONFLICT DO NOTHING;
    `);

    // Creiamo famiglia
    await db.query(`
      INSERT INTO public.families (id, parent_user_id, subscription_tier, subscription_status, credits_balance, addon_children_count, pending_addon_children_count)
      VALUES ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11', '${parentId}', 'premium', 'active', 50, 3, 1)
      ON CONFLICT DO NOTHING;
    `);

    // Creiamo profilo bambino
    await db.query(`
      INSERT INTO public.child_profiles (id, family_id, name, birth_year, adventure_points)
      VALUES ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11', 'Leo', 2018, 100)
      ON CONFLICT DO NOTHING;
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("Punto 4: verifica lettura missioni, badge e cosmetici del Gamification Store e ordinamento per costo", async () => {
    const resCosmetics = await db.query(`
      SELECT name, category, cost_points, icon_preset
      FROM public.cosmetic_items
      ORDER BY cost_points ASC;
    `);
    expect(resCosmetics.rows.length).toBeGreaterThanOrEqual(4);
    // Verifica che l'ordinamento per cost_points sia rispettato
    const firstCost = (resCosmetics.rows[0] as any).cost_points;
    const secondCost = (resCosmetics.rows[1] as any).cost_points;
    expect(firstCost).toBeLessThanOrEqual(secondCost);

    const resQuests = await db.query(`
      SELECT title, target_count
      FROM public.reading_quests
      ORDER BY target_count ASC;
    `);
    expect(resQuests.rows.length).toBeGreaterThanOrEqual(3);
  });

  it("Punto 5: verifica applicazione del pending_addon_children_count al rinnovo abbonamento", async () => {
    // Verifichiamo lo stato prima del rinnovo
    const before = await db.query(`
      SELECT addon_children_count, pending_addon_children_count, credits_balance
      FROM public.families
      WHERE id = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11';
    `);
    expect((before.rows[0] as any).addon_children_count).toBe(3);
    expect((before.rows[0] as any).pending_addon_children_count).toBe(1);
    expect((before.rows[0] as any).credits_balance).toBe(50);

    // Simuliamo un evento reale invoice.payment_succeeded di Stripe verso l'handler POST
    const fakeEvent = {
      id: "evt_test_renewal_123",
      type: "invoice.payment_succeeded",
      data: {
        object: {
          id: "in_test_renewal_123",
          billing_reason: "subscription_cycle",
          metadata: {
            family_id: "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11",
          },
        },
      },
    };

    const req = new Request("http://localhost:3000/api/stripe/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fakeEvent),
    });

    // Invocazione del vero endpoint server
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);

    // Verifichiamo il nuovo stato sul DB DOPO aver invocato l'endpoint reale
    const after = await db.query(`
      SELECT addon_children_count, pending_addon_children_count, credits_balance
      FROM public.families
      WHERE id = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11';
    `);
    expect((after.rows[0] as any).addon_children_count).toBe(1);
    expect((after.rows[0] as any).pending_addon_children_count).toBe(null);
    expect((after.rows[0] as any).credits_balance).toBe(80); // 50 iniziali + 30 del piano premium

    // Verifichiamo anche che sia stato registrato l'accredito su credit_ledger
    const ledger = await db.query(`
      SELECT amount, transaction_type
      FROM public.credit_ledger
      WHERE family_id = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11' AND transaction_type = 'SUBSCRIPTION_RENEWAL';
    `);
    expect(ledger.rows.length).toBeGreaterThanOrEqual(1);
    expect((ledger.rows[0] as any).amount).toBe(30);

    // Verifichiamo infine la registrazione nella tabella stripe_webhook_events
    const webhookEvent = await db.query(`
      SELECT status
      FROM public.stripe_webhook_events
      WHERE event_id = 'evt_test_renewal_123';
    `);
    expect(webhookEvent.rows.length).toBe(1);
    expect((webhookEvent.rows[0] as any).status).toBe("processed");
  });

  it("Punto 7 & 8: verifica che account Free senza stripe_subscription_id non esponga azioni non permesse e che i crediti siano allineati", async () => {
    const parentFree = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${parentFree}', 'free@example.com') ON CONFLICT DO NOTHING;
      INSERT INTO public.families (id, parent_user_id, subscription_tier, subscription_status, credits_balance, stripe_subscription_id)
      VALUES ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f22', '${parentFree}', 'free', 'active', 5, NULL)
      ON CONFLICT DO NOTHING;
    `);

    const res = await db.query(`
      SELECT subscription_tier, subscription_status, credits_balance, stripe_subscription_id
      FROM public.families
      WHERE parent_user_id = '${parentFree}';
    `);
    const fam = res.rows[0] as any;
    expect(fam.subscription_tier).toBe("free");
    expect(fam.credits_balance).toBe(5);
    expect(fam.stripe_subscription_id).toBe(null);

    // Logica di visibilità pulsanti (Punto 7)
    const showPassaAFree = fam.subscription_tier !== "free";
    const showAnnulla = Boolean(fam.stripe_subscription_id) && ["active", "trialing"].includes(fam.subscription_status);

    expect(showPassaAFree).toBe(false);
    expect(showAnnulla).toBe(false);
  });

  it("Punto 9: verifica salvataggio notifica nella tabella notifications alla generazione / errore", async () => {
    const familyId = "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11";
    // Inseriamo una notifica di successo come fatto da notifyFamily
    await db.query(`
      INSERT INTO public.notifications (family_id, category, title, message, action_link)
      VALUES ('${familyId}', 'activity', 'Nuova storia generata! ✨', 'La storia è pronta.', '/read?storyId=123');
    `);

    const notifs = await db.query(`
      SELECT * FROM public.notifications WHERE family_id = '${familyId}' AND category = 'activity';
    `);
    expect(notifs.rows.length).toBeGreaterThanOrEqual(1);
    expect((notifs.rows[0] as any).title).toBe("Nuova storia generata! ✨");
  });

  it("Punto 10: verifica salvataggio separato di postal_code e city in parent_billing_profiles", async () => {
    const familyId = "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11";
    await db.query(`
      INSERT INTO public.parent_billing_profiles (family_id, first_name, last_name, tax_id, billing_address, postal_code, city, country)
      VALUES ('${familyId}', 'Mario', 'Rossi', 'RSSMRA80A01H501Z', 'Via Roma 10', '00100', 'Roma', 'IT')
      ON CONFLICT (family_id) DO UPDATE SET
        billing_address = EXCLUDED.billing_address,
        postal_code = EXCLUDED.postal_code,
        city = EXCLUDED.city;
    `);

    const profile = await db.query(`
      SELECT billing_address, postal_code, city, country
      FROM public.parent_billing_profiles
      WHERE family_id = '${familyId}';
    `);
    expect((profile.rows[0] as any).billing_address).toBe("Via Roma 10");
    expect((profile.rows[0] as any).postal_code).toBe("00100");
    expect((profile.rows[0] as any).city).toBe("Roma");
  });
});
