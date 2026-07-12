import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { enforceSuspensionOnDowngrade } from "@/lib/billing-utils";

describe("StoriIA v1.0 - Downgrade Tier & enforceSuspensionOnDowngrade Real Execution", () => {
  let db: PGlite;

  // Adattatore Supabase->PGlite per permettere alle funzioni server di interrogare il DB PGlite reale
  const createPGliteSupabaseAdapter = (pglite: PGlite) => ({
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
          then: async (resolve: (val: any) => void) => {
            const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
            const res = await pglite.query(`SELECT * FROM public.${table} ${whereStr} ${orderClause}`);
            resolve({ data: res.rows, error: null });
          },
        }),
        update: (data: Record<string, any>) => ({
          in: async (col: string, vals: string[]) => {
            const setStr = Object.entries(data)
              .map(([k, v]) => `${k} = ${typeof v === "boolean" ? v : `'${v}'`}`)
              .join(", ");
            const inStr = vals.map((v) => `'${v}'`).join(", ");
            await pglite.query(`UPDATE public.${table} SET ${setStr} WHERE ${col} IN (${inStr})`);
            return { error: null };
          },
        }),
      };
    },
  });

  beforeAll(async () => {
    db = new PGlite();

    await db.exec(`
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE service_role NOLOGIN;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);

      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
      LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;

      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB
      LANGUAGE sql STABLE AS $$
        SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
      $$;
    `);

    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/01_mvp_schema.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/04_v1_phase2_billing_and_credits.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/05_v1_phase3_gamification.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260712000000_v1_unlockable_content.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260712120000_v1_bugfixes_schema.sql"), "utf-8"));

    // Popoliamo una famiglia con tier Family e 4 profili bambino attivi
    await db.exec(`
      INSERT INTO auth.users (id) VALUES ('11111111-1111-1111-1111-111111111111');
      INSERT INTO public.families (id, parent_user_id, subscription_tier, addon_children_count)
      VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'family', 0);

      INSERT INTO public.child_profiles (id, family_id, name, created_at, is_suspended)
      VALUES 
        ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222222', 'Primo', '2026-01-01T10:00:00Z', false),
        ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222222', 'Secondo', '2026-01-02T10:00:00Z', false),
        ('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222222', 'Terzo', '2026-01-03T10:00:00Z', false),
        ('33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222222', 'Quarto', '2026-01-04T10:00:00Z', false);
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("deve chiamare la funzione VERA enforceSuspensionOnDowngrade e sospendere realmente i 3 profili bambino eccedenti su PGlite", async () => {
    const familyId = "22222222-2222-2222-2222-222222222222";
    const adapter = createPGliteSupabaseAdapter(db);

    // Chiamata alla funzione VERA dell'applicazione, non simulata in test
    const { suspendedCount } = await enforceSuspensionOnDowngrade(adapter, familyId, "free");

    expect(suspendedCount).toBe(3);

    // Verifica su database reale PGlite
    const countActive = await db.query<{ count: string }>(`
      SELECT count(*)::text as count FROM public.child_profiles WHERE family_id = '${familyId}' AND is_suspended = false;
    `);
    const countSuspended = await db.query<{ count: string }>(`
      SELECT count(*)::text as count FROM public.child_profiles WHERE family_id = '${familyId}' AND is_suspended = true;
    `);

    expect(Number(countActive.rows[0].count)).toBe(1);
    expect(Number(countSuspended.rows[0].count)).toBe(3);
  });

  it("deve confermare nel DB che l'ultimo profilo bambino è stato sospeso (is_suspended = true)", async () => {
    const childId = "33333333-3333-3333-3333-333333333304";
    const res = await db.query<{ is_suspended: boolean }>(`
      SELECT is_suspended FROM public.child_profiles WHERE id = '${childId}';
    `);

    expect(res.rows[0].is_suspended).toBe(true);
  });
});
