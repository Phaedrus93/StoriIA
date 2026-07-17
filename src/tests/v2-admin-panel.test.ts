import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { checkAdminPrivileges } from "@/lib/admin";
import { getSubscriptionPlan, getAllSubscriptionPlans } from "@/lib/plans";
import { GET as getPlansRoute, PUT as putPlansRoute } from "@/app/api/admin/subscription-plans/route";
import { PUT as putAppConfigRoute } from "@/app/api/admin/app-config/route";

// Variabili globali per mock server e auth
let currentMockUser: { id: string; email: string; user_metadata?: Record<string, any> } | null = null;
let db: PGlite;

const adminId = "a1111111-1111-1111-1111-111111111111";
const normalParentId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55";

// Mock Supabase Server e Admin adapters per testare le API routes all'interno di Vitest
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: currentMockUser },
        error: currentMockUser ? null : { message: "Non autenticato" },
      }),
    },
    from: (table: string) => ({
      select: (cols: string = "*") => ({
        order: () => ({
          async then(resolve: any) {
            try {
              const res = await db.query(`SELECT ${cols} FROM public.${table}`);
              resolve({ data: res.rows, error: null });
            } catch (err: any) {
              resolve({ data: null, error: err });
            }
          },
        }),
        eq: (col: string, val: any) => ({
          order: () => ({
            async then(resolve: any) {
              try {
                const res = await db.query(`SELECT ${cols} FROM public.${table} WHERE ${col} = '${val}'`);
                resolve({ data: res.rows, error: null });
              } catch (err: any) {
                resolve({ data: null, error: err });
              }
            },
          }),
          single: async () => {
            try {
              const res = await db.query(`SELECT ${cols} FROM public.${table} WHERE ${col} = '${val}' LIMIT 1`);
              return { data: res.rows[0] || null, error: res.rows[0] ? null : { message: "Not found" } };
            } catch (err: any) {
              return { data: null, error: err };
            }
          },
        }),
        async then(resolve: any) {
          try {
            const res = await db.query(`SELECT ${cols} FROM public.${table}`);
            resolve({ data: res.rows, error: null });
          } catch (err: any) {
            resolve({ data: null, error: err });
          }
        },
      }),
    }),
  }),
}));

vi.mock("@/lib/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin")>();
  return {
    ...actual,
    createAdminClient: () => ({
      from: (table: string) => ({
        update: (updates: Record<string, any>) => ({
          eq: (col: string, val: any) => ({
            select: () => ({
              single: async () => {
                try {
                  const setParts: string[] = [];
                  for (const [k, v] of Object.entries(updates)) {
                    if (k === "value") {
                      const jsonStr = typeof v === "string" ? (v.startsWith('"') || v.startsWith('{') || v.startsWith('[') ? v : JSON.stringify(v)) : JSON.stringify(v);
                      setParts.push(`${k} = '${jsonStr}'::jsonb`);
                    } else if (typeof v === "string") setParts.push(`${k} = '${v.replace(/'/g, "''")}'`);
                    else if (typeof v === "boolean" || typeof v === "number") setParts.push(`${k} = ${v}`);
                    else if (v === null) setParts.push(`${k} = NULL`);
                    else setParts.push(`${k} = '${JSON.stringify(v).replace(/'/g, "''")}'`);
                  }
                  await db.query(`UPDATE public.${table} SET ${setParts.join(", ")} WHERE ${col} = '${val}'`);
                  const res = await db.query(`SELECT * FROM public.${table} WHERE ${col} = '${val}' LIMIT 1`);
                  return { data: res.rows[0] || null, error: null };
                } catch (err: any) {
                  return { data: null, error: err };
                }
              },
            }),
            async then(resolve: any) {
              try {
                const setParts: string[] = [];
                for (const [k, v] of Object.entries(updates)) {
                  if (k === "value") {
                    const jsonStr = typeof v === "string" ? (v.startsWith('"') || v.startsWith('{') || v.startsWith('[') ? v : JSON.stringify(v)) : JSON.stringify(v);
                    setParts.push(`${k} = '${jsonStr}'::jsonb`);
                  } else if (typeof v === "string") setParts.push(`${k} = '${v.replace(/'/g, "''")}'`);
                  else if (typeof v === "boolean" || typeof v === "number") setParts.push(`${k} = ${v}`);
                  else if (v === null) setParts.push(`${k} = NULL`);
                  else setParts.push(`${k} = '${JSON.stringify(v).replace(/'/g, "''")}'`);
                }
                await db.query(`UPDATE public.${table} SET ${setParts.join(", ")} WHERE ${col} = '${val}'`);
                resolve({ error: null });
              } catch (err: any) {
                resolve({ error: err });
              }
            },
          }),
        }),
        upsert: (record: Record<string, any>, opts?: { onConflict?: string }) => ({
          select: () => ({
            single: async () => {
              try {
                const cols = Object.keys(record);
                const vals = Object.values(record).map((v, i) => {
                  const col = cols[i];
                  if (col === "value") {
                    const jsonStr = typeof v === "string" ? (v.startsWith('"') || v.startsWith('{') || v.startsWith('[') ? v : JSON.stringify(v)) : JSON.stringify(v);
                    return `'${jsonStr}'::jsonb`;
                  }
                  if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
                  if (v === null) return "NULL";
                  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
                  return v;
                });
                const conflictCol = opts?.onConflict || "key";
                const updates = cols.filter((c) => c !== conflictCol).map((c) => `${c} = EXCLUDED.${c}`).join(", ");
                await db.query(`
                  INSERT INTO public.${table} (${cols.join(", ")}) VALUES (${vals.join(", ")})
                  ON CONFLICT (${conflictCol}) DO UPDATE SET ${updates}
                `);
                const keyVal = record[conflictCol];
                const res = await db.query(`SELECT * FROM public.${table} WHERE ${conflictCol} = '${keyVal}' LIMIT 1`);
                return { data: res.rows[0] || null, error: null };
              } catch (err: any) {
                return { data: null, error: err };
              }
            },
          }),
        }),
      }),
    }),
  };
});

describe("V2 Phase 4: Admin Panel, Subscription Plans & Centralized App Config", () => {
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

    // Caricamento schema principale e migrazione admin
    const schemaPath = path.resolve(process.cwd(), "sql/01_mvp_schema.sql");
    const sqlSchema = fs.readFileSync(schemaPath, "utf-8");
    await db.exec(sqlSchema);

    const adminMigrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20260718000000_v2_phase4_admin_panel_and_subscription_plans.sql"
    );
    const sqlAdmin = fs.readFileSync(adminMigrationPath, "utf-8");
    await db.exec(sqlAdmin);

    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${adminId}', 'admin@storiia.com');
      INSERT INTO auth.users (id, email) VALUES ('${normalParentId}', 'parent@storiia.com');
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("1. Controllo privilegi checkAdminPrivileges: rifiuta utente normale e autorizza admin", async () => {
    // Utente normale
    currentMockUser = { id: normalParentId, email: "parent@storiia.com", user_metadata: { role: "parent" } };
    const mockClientNorm: any = {
      auth: { getUser: async () => ({ data: { user: currentMockUser }, error: null }) },
    };
    const check1 = await checkAdminPrivileges(mockClientNorm);
    expect(check1.isAdmin).toBe(false);

    // Utente admin per email
    currentMockUser = { id: adminId, email: "admin@storiia.com" };
    const mockClientAdmin: any = {
      auth: { getUser: async () => ({ data: { user: currentMockUser }, error: null }) },
    };
    const check2 = await checkAdminPrivileges(mockClientAdmin);
    expect(check2.isAdmin).toBe(true);

    // Utente admin per metadata
    currentMockUser = { id: normalParentId, email: "other@storiia.com", user_metadata: { is_admin: true } };
    const mockClientMeta: any = {
      auth: { getUser: async () => ({ data: { user: currentMockUser }, error: null }) },
    };
    const check3 = await checkAdminPrivileges(mockClientMeta);
    expect(check3.isAdmin).toBe(true);
  });

  it("2. Operazioni di scrittura sui Piani Abbonamento (PUT /api/admin/subscription-plans) con createAdminClient e rifiuto 403", async () => {
    // Tentativo da utente non-admin -> deve ritornare 403
    currentMockUser = { id: normalParentId, email: "parent@storiia.com" };
    const putReq403 = new Request("http://localhost/api/admin/subscription-plans", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier: "premium", monthly_credits: 999 }),
    });
    const res403 = await putPlansRoute(putReq403);
    expect(res403.status).toBe(403);

    // Esecuzione da Admin -> deve aggiornare il database con createAdminClient
    currentMockUser = { id: adminId, email: "admin@storiia.com" };
    const putReq200 = new Request("http://localhost/api/admin/subscription-plans", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plans: [
          { tier: "premium", monthly_credits: 45, max_children: 4 },
        ],
      }),
    });
    const res200 = await putPlansRoute(putReq200);
    expect(res200.status).toBe(200);
    const data200 = await res200.json();
    expect(data200.success).toBe(true);

    // Verifica nel database reale (PGlite) che i nuovi valori siano salvati
    const resQuery = await db.query("SELECT monthly_credits, max_children FROM public.subscription_plans WHERE tier = 'premium'");
    expect(resQuery.rows[0].monthly_credits).toBe(45);
    expect(resQuery.rows[0].max_children).toBe(4);
  });

  it("3. Logica di fallback ([CRITICAL DB FALLBACK]) quando il database fallisce in getSubscriptionPlan", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Fornisci un client mock che simula un errore del database o assenza tabella
    const failingSupabase: any = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: { message: "relation subscription_plans does not exist" } }),
          }),
        }),
      }),
    };

    const plan = await getSubscriptionPlan("family", failingSupabase);

    // Verifica che abbia ricaduto sui valori in-memory (80 crediti mensili per family)
    expect(plan.tier).toBe("family");
    expect(plan.monthlyCredits).toBe(80);
    expect(plan.maxChildren).toBe(6);

    // Verifica che sia stato emesso il log ad alta visibilità
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[CRITICAL DB FALLBACK]"),
      expect.any(String),
      expect.any(String),
      expect.any(Object)
    );

    consoleSpy.mockRestore();
  });

  it("4. Validazione menu a tendina modelli Gemini in app_config_parameters (PUT /api/admin/app-config)", async () => {
    currentMockUser = { id: adminId, email: "admin@storiia.com" };

    // Tentativo di salvare un modello inesistente/errato -> deve fallire con 400
    const reqInvalid = new Request("http://localhost/api/admin/app-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "ai_default_model",
        value: "gemini-3.0-ultra-nonexistent",
      }),
    });
    const resInvalid = await putAppConfigRoute(reqInvalid);
    expect(resInvalid.status).toBe(400);
    const errData = await resInvalid.json();
    expect(errData.error).toContain("Modello Gemini non valido");

    // Tentativo di salvare un modello valido in whitelist -> deve avere successo con 200
    const reqValid = new Request("http://localhost/api/admin/app-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "ai_default_model",
        value: "gemini-2.5-flash",
      }),
    });
    const resValid = await putAppConfigRoute(reqValid);
    expect(resValid.status).toBe(200);

    // Verifica nel database (PGlite)
    const dbCheck = await db.query("SELECT value FROM public.app_config_parameters WHERE key = 'ai_default_model'");
    expect(dbCheck.rows[0].value).toBe("gemini-2.5-flash");
  });
});
