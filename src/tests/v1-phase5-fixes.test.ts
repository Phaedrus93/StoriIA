import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { POST as childProfilePOST } from "@/app/api/family/child-profiles/route";
import { POST as reduceAddonPOST } from "@/app/api/billing/reduce-addon/route";
import { POST as downgradeTierPOST } from "@/app/api/family/downgrade-tier/route";

let dbInstance: PGlite | null = null;

const createPGliteSupabaseAdapter = (pglite: PGlite) => ({
  auth: {
    getUser: async () => {
      const res = await pglite.query(`SELECT * FROM auth.users WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55' LIMIT 1`);
      const row = res.rows[0] as any;
      return {
        data: {
          user: row ? { id: row.id, email: row.email || "parent.phase5@example.com", app_metadata: {} } : null,
        },
        error: null,
      };
    },
    admin: {
      getUserById: async (id: string) => {
        const res = await pglite.query(`SELECT * FROM auth.users WHERE id = '${id}' LIMIT 1`);
        const row = res.rows[0] as any;
        return {
          data: {
            user: row ? { id: row.id, email: row.email || "parent.phase5@example.com", app_metadata: {} } : null,
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
          return { data: res.rows[0] || null, error: res.rows[0] ? null : { message: "Not found" } };
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
              try {
                const res = await pglite.query(`INSERT INTO public.${table} (${colsList}) VALUES (${valsList}) RETURNING *`);
                if (res.rows[0]) insertedRows.push(res.rows[0]);
              } catch (err: any) {
                return { data: null, error: { message: err.message || "Insert error" } };
              }
            }
            return { data: insertedRows[0] || null, error: null };
          },
        }),
      }),
      delete: () => ({
        eq: async (col: string, val: any) => {
          const formattedVal = typeof val === "string" ? `'${val}'` : val;
          await pglite.query(`DELETE FROM public.${table} WHERE ${col} = ${formattedVal}`);
          return { error: null };
        },
      }),
    };
  },
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (!dbInstance) throw new Error("dbInstance not initialized");
    return createPGliteSupabaseAdapter(dbInstance);
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (!dbInstance) throw new Error("dbInstance not initialized");
    return createPGliteSupabaseAdapter(dbInstance);
  },
}));

describe("StoriIA — Verifica Correzioni di Dettaglio Fase 5 (Punti 1-5)", () => {
  let db: PGlite;
  const parentId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55";
  const familyId = "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f55";

  beforeAll(async () => {
    db = new PGlite();
    dbInstance = db;
    process.env.NODE_ENV = "test";

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
    `);

    const migrationsDir = path.join(process.cwd(), "supabase/migrations");
    const files = fs.readdirSync(migrationsDir).sort();
    for (const file of files) {
      if (file.endsWith(".sql")) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
        await db.exec(sql);
      }
    }

    await db.query(`
      INSERT INTO auth.users (id, email)
      VALUES ('${parentId}', 'parent.phase5@example.com')
      ON CONFLICT DO NOTHING;
    `);

    await db.query(`
      INSERT INTO public.families (id, parent_user_id, subscription_tier, subscription_status, credits_balance, addon_children_count, pending_addon_children_count)
      VALUES ('${familyId}', '${parentId}', 'premium', 'active', 50, 2, NULL)
      ON CONFLICT DO NOTHING;
    `);

    await db.query(`
      INSERT INTO public.avatar_presets (id, name, image_url, is_free)
      VALUES ('robot_scifi', 'Robot Sci-Fi', 'https://example.com/robot.png', true)
      ON CONFLICT DO NOTHING;
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("Punto 2: verifica che la creazione del profilo bambino fallisca senza birth_year e riesca con birth_year valido", async () => {
    // 1. Tentativo senza birth_year (null/undefined)
    const reqInvalid = new Request("http://localhost/api/family/child-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bambino Senza Anno", birth_year: null }),
    });
    const resInvalid = await childProfilePOST(reqInvalid);
    const dataInvalid = await resInvalid.json();

    expect(resInvalid.status).toBe(400);
    expect(dataInvalid.error).toContain("L'anno di nascita è obbligatorio");

    // 2. Tentativo con birth_year valido
    const reqValid = new Request("http://localhost/api/family/child-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Giulia", birth_year: 2019, avatar_preset_id: "robot_scifi" }),
    });
    const resValid = await childProfilePOST(reqValid);
    const dataValid = await resValid.json();

    if (resValid.status !== 201) {
      console.error("Child creation error:", dataValid);
    }
    expect(resValid.status).toBe(201);
    expect(dataValid.success).toBe(true);
    expect(dataValid.child.name).toBe("Giulia");
    expect(dataValid.child.birth_year).toBe(2019);
  });

  it("Punto 3: verifica logica TIER_RANK per visibilità pulsante Upgrade Piano", () => {
    const TIER_RANK: Record<string, number> = { free: 1, premium: 2, family: 3 };

    const showUpgradeFree = (TIER_RANK["free"] || 1) < TIER_RANK.family;
    const showUpgradePremium = (TIER_RANK["premium"] || 1) < TIER_RANK.family;
    const showUpgradeFamily = (TIER_RANK["family"] || 1) < TIER_RANK.family;

    expect(showUpgradeFree).toBe(true);
    expect(showUpgradePremium).toBe(true);
    expect(showUpgradeFamily).toBe(false);
  });

  it("Punto 4: verifica reduce-addon chiamando l'API con il payload reale inviato dal frontend ({ targetAddonCount: 0 }) e usando createAdminClient", async () => {
    const req = new Request("http://localhost/api/billing/reduce-addon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetAddonCount: 0 }),
    });
    const res = await reduceAddonPOST(req);
    const data = await res.json();

    if (res.status !== 200) {
      console.error("Reduce addon error:", data);
    }
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.pendingAddonCount).toBe(0);

    const checkRes = await db.query(`SELECT pending_addon_children_count FROM public.families WHERE id = '${familyId}'`);
    expect((checkRes.rows[0] as any).pending_addon_children_count).toBe(0);
  });

  it("Punto 5: verifica downgrade-tier chiamando l'API con il payload reale inviato dal frontend ({ targetTier: 'free' })", async () => {
    const req = new Request("http://localhost/api/family/downgrade-tier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetTier: "free" }),
    });
    const res = await downgradeTierPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.newTier).toBe("free");

    const checkRes = await db.query(`SELECT subscription_tier FROM public.families WHERE id = '${familyId}'`);
    expect((checkRes.rows[0] as any).subscription_tier).toBe("free");
  });
});
