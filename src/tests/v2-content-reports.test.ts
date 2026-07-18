import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { POST as postReportRoute } from "@/app/api/stories/report/route";
import { GET as getReportsRoute, PUT as putReportRoute } from "@/app/api/admin/content-reports/route";

let currentMockUser: {
  id: string;
  email: string;
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
} | null = null;
let currentMockCookieChildMode = false;
let db: PGlite;

const parentIdA = "a1111111-1111-1111-1111-111111111111";
const parentIdB = "b2222222-2222-2222-2222-222222222222";
const adminId = "c3333333-3333-3333-3333-333333333333";

const familyIdA = "fa111111-1111-1111-1111-111111111111";
const familyIdB = "fb222222-2222-2222-2222-222222222222";

const storyIdA = "d1111111-1111-1111-1111-111111111111";
const storyIdB = "d2222222-2222-2222-2222-222222222222";

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (key: string) => {
      if (key === "storiia_child_mode") {
        return { value: currentMockCookieChildMode ? "true" : "false" };
      }
      return null;
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: currentMockUser },
        error: currentMockUser ? null : { message: "Non autenticato" },
      }),
    },
    from: (table: string) => makeQueryBuilder(table, false),
  }),
}));

vi.mock("@/lib/admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin")>();
  return {
    ...actual,
    checkAdminPrivileges: async () => {
      if (!currentMockUser) return { isAdmin: false, error: "Non autenticato" };
      if (currentMockUser.app_metadata?.is_admin === true) {
        return { isAdmin: true, error: null };
      }
      return { isAdmin: false, error: "Privilegi di amministratore richiesti" };
    },
    createAdminClient: () => ({
      from: (table: string) => makeQueryBuilder(table, true),
    }),
  };
});

function makeQueryBuilder(table: string, isAdmin: boolean) {
  let filters: Record<string, any> = {};
  let colsToSelect: string = "*";
  let orderCol: string | null = null;
  let orderAsc: boolean = true;

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
        await applyRoleAndSub(isAdmin);
        const whereParts = Object.entries(filters).map(([k, v]) => `${k} = '${v}'`);
        const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
        const res = await db.query(`SELECT * FROM public.${table} ${whereClause} LIMIT 1`);
        await resetRoleAndSub();
        return { data: res.rows[0] || null, error: res.rows[0] ? null : { message: "Not found" } };
      } catch (err: any) {
        await resetRoleAndSub();
        return { data: null, error: err };
      }
    },
    async then(resolve: any) {
      try {
        await applyRoleAndSub(isAdmin);
        const whereParts = Object.entries(filters).map(([k, v]) => `${k} = '${v}'`);
        const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
        const orderClause = orderCol ? `ORDER BY ${orderCol} ${orderAsc ? "ASC" : "DESC"}` : "";
        const res = await db.query(`SELECT * FROM public.${table} ${whereClause} ${orderClause}`);
        await resetRoleAndSub();
        resolve({ data: res.rows, error: null });
      } catch (err: any) {
        await resetRoleAndSub();
        resolve({ data: null, error: err });
      }
    },
    insert: (rec: any) => ({
      select: () => ({
        single: async () => {
          try {
            await applyRoleAndSub(isAdmin);
            const cols = Object.keys(rec);
            const vals = Object.values(rec).map((v) => {
              if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
              if (v === null || v === undefined) return "NULL";
              return v;
            });
            const res = await db.query(`
              INSERT INTO public.${table} (${cols.join(", ")})
              VALUES (${vals.join(", ")})
              RETURNING *
            `);
            await resetRoleAndSub();
            return { data: res.rows[0] || null, error: null };
          } catch (err: any) {
            await resetRoleAndSub();
            return { data: null, error: err };
          }
        },
      }),
    }),
    update: (updates: Record<string, any>) => ({
      eq: (col: string, val: any) => ({
        select: () => ({
          single: async () => {
            try {
              await applyRoleAndSub(isAdmin);
              const setParts = Object.entries(updates).map(([k, v]) => {
                if (typeof v === "string") return `${k} = '${v.replace(/'/g, "''")}'`;
                if (v === null || v === undefined) return `${k} = NULL`;
                return `${k} = ${v}`;
              });
              const res = await db.query(`
                UPDATE public.${table}
                SET ${setParts.join(", ")}
                WHERE ${col} = '${val}'
                RETURNING *
              `);
              await resetRoleAndSub();
              return { data: res.rows[0] || null, error: null };
            } catch (err: any) {
              await resetRoleAndSub();
              return { data: null, error: err };
            }
          },
        }),
      }),
    }),
  };

  return chain;
}

async function applyRoleAndSub(isAdmin: boolean) {
  if (isAdmin || !currentMockUser) {
    await db.exec("RESET ROLE; RESET request.jwt.claim.sub;");
  } else {
    await db.exec(`
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '${currentMockUser.id}';
    `);
  }
}

async function resetRoleAndSub() {
  await db.exec("RESET ROLE; RESET request.jwt.claim.sub;");
}

describe("v2-content-reports.test.ts — Segnalazione Contenuto Problematico (PGlite)", () => {
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

    // Caricamento schemi MVP e successive migrazioni incluse Fase 4 e Fase 7
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/01_mvp_schema.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/04_v1_phase2_billing_and_credits.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260712120000_v1_bugfixes_schema.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260718000000_v2_phase4_admin_panel_and_subscription_plans.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260719120000_v2_phase7_content_reports.sql"), "utf-8"));

    // Grant permessi a role authenticated
    await db.exec(`
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    `);

    // Popolamento utenti auth.users
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${parentIdA}', 'parentA@example.com');
      INSERT INTO auth.users (id, email) VALUES ('${parentIdB}', 'parentB@example.com');
      INSERT INTO auth.users (id, email) VALUES ('${adminId}', 'admin@example.com');
    `);

    // Popolamento famiglie
    await db.exec(`
      INSERT INTO public.families (id, parent_user_id, subscription_tier, subscription_status, credits_balance)
      VALUES ('${familyIdA}', '${parentIdA}', 'free', 'active', 5);

      INSERT INTO public.families (id, parent_user_id, subscription_tier, subscription_status, credits_balance)
      VALUES ('${familyIdB}', '${parentIdB}', 'premium', 'active', 15);
    `);

    // Popolamento storie
    await db.exec(`
      INSERT INTO public.stories (id, family_id, generated_text, target_age_range)
      VALUES ('${storyIdA}', '${familyIdA}', 'Il Drago Spaventoso della Foresta Nera', '0-3');

      INSERT INTO public.stories (id, family_id, generated_text, target_age_range)
      VALUES ('${storyIdB}', '${familyIdB}', 'Il Castello di Ghiaccio Incantato', '4-6');
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(() => {
    currentMockCookieChildMode = false;
  });

  it("1. Creazione segnalazione da genitore autenticato va a buon fine (POST /api/stories/report)", async () => {
    currentMockUser = { id: parentIdA, email: "parentA@example.com" };

    const req = new Request("http://localhost/api/stories/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        story_id: storyIdA,
        reason_category: "inappropriate_theme",
        details: "Il drago fa troppa paura per un bambino di 3 anni",
      }),
    });

    const res = await postReportRoute(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.report.story_id).toBe(storyIdA);
    expect(data.report.reported_by_family_id).toBe(familyIdA);
    expect(data.report.reason_category).toBe("inappropriate_theme");
    expect(data.report.status).toBe("pending");
  });

  it("2. Blocco del pulsante / endpoint in modalità bambino (403)", async () => {
    // Caso 2a: Cookie storiia_child_mode=true
    currentMockUser = { id: parentIdA, email: "parentA@example.com" };
    currentMockCookieChildMode = true;

    const reqCookie = new Request("http://localhost/api/stories/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        story_id: storyIdA,
        reason_category: "bad_language",
      }),
    });

    const resCookie = await postReportRoute(reqCookie);
    expect(resCookie.status).toBe(403);
    const dataCookie = await resCookie.json();
    expect(dataCookie.error).toContain("riservata all'area genitore");

    // Caso 2b: Metadata JWT is_child_mode=true (e cookie false)
    currentMockCookieChildMode = false;
    currentMockUser = {
      id: parentIdA,
      email: "parentA@example.com",
      app_metadata: { is_child_mode: true },
    };

    const reqMeta = new Request("http://localhost/api/stories/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        story_id: storyIdA,
        reason_category: "bad_language",
      }),
    });

    const resMeta = await postReportRoute(reqMeta);
    expect(resMeta.status).toBe(403);
  });

  it("3. Isolamento RLS tra famiglie diverse sulla lettura (SELECT content_reports)", async () => {
    // La Famiglia A ha inserito una segnalazione nello scenario 1.
    // Eseguiamo una query RLS autenticata come Famiglia B (parentIdB).
    currentMockUser = { id: parentIdB, email: "parentB@example.com" };
    await applyRoleAndSub(false);

    const resB = await db.query("SELECT * FROM public.content_reports");
    await resetRoleAndSub();

    // Famiglia B deve vedere 0 record
    expect(resB.rows.length).toBe(0);

    // Eseguiamo una query RLS autenticata come Famiglia A (parentIdA).
    currentMockUser = { id: parentIdA, email: "parentA@example.com" };
    await applyRoleAndSub(false);

    const resA = await db.query("SELECT * FROM public.content_reports");
    await resetRoleAndSub();

    // Famiglia A deve vedere il proprio record
    expect(resA.rows.length).toBeGreaterThan(0);
    expect((resA.rows[0] as any).reported_by_family_id).toBe(familyIdA);
  });

  it("4. Nessun blocco o modifica automatica della storia (status e leggibilità inalterati dopo la segnalazione)", async () => {
    const resStory = await db.query(`SELECT * FROM public.stories WHERE id = '${storyIdA}'`);
    expect(resStory.rows.length).toBe(1);
    const story = resStory.rows[0] as any;
    expect(story.generated_text).toBe("Il Drago Spaventoso della Foresta Nera");
    expect(story.target_age_range).toBe("0-3");
  });

  it("5. Accesso admin alla lista completa e possibilità di cambiare stato (reviewed/dismissed)", async () => {
    // Tentativo da genitore normale -> 403
    currentMockUser = { id: parentIdA, email: "parentA@example.com" };
    const reqGet403 = new Request("http://localhost/api/admin/content-reports");
    const resGet403 = await getReportsRoute();
    expect(resGet403.status).toBe(403);

    // Tentativo da amministratore effettivo (app_metadata.is_admin === true) -> 200
    currentMockUser = {
      id: adminId,
      email: "admin@example.com",
      app_metadata: { is_admin: true },
    };

    const resGet200 = await getReportsRoute();
    const dataGet = await resGet200.json();
    expect(resGet200.status).toBe(200);
    expect(Array.isArray(dataGet.reports)).toBe(true);
    expect(dataGet.reports.length).toBeGreaterThanOrEqual(1);

    const reportToUpdate = dataGet.reports[0];
    expect(reportToUpdate.status).toBe("pending");

    // Cambio status in 'reviewed' tramite PUT /api/admin/content-reports
    const reqPut = new Request("http://localhost/api/admin/content-reports", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: reportToUpdate.id,
        status: "reviewed",
      }),
    });

    const resPut = await putReportRoute(reqPut);
    const dataPut = await resPut.json();
    expect(resPut.status).toBe(200);
    expect(dataPut.success).toBe(true);
    expect(dataPut.report.status).toBe("reviewed");
    expect(dataPut.report.reviewed_at).not.toBeNull();
  });
});
