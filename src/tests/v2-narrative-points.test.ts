import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import {
  handleGamificationGetServer,
  handleGamificationActionServer,
} from "../app/api/child/gamification/route";

describe("StoriIA v2 - Gamification & Contenuti Narrativi a Punti", () => {
  let pglite: PGlite;
  let adminClient: any;

  beforeAll(async () => {
    pglite = new PGlite();

    await pglite.exec(`
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE service_role NOLOGIN;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);

      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
      LANGUAGE sql STABLE AS $$
        SELECT '11111111-1111-1111-1111-111111111111'::uuid;
      $$;

      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB
      LANGUAGE sql STABLE AS $$
        SELECT '{}'::jsonb;
      $$;
    `);

    // Caricamento schema reale completo e migrazioni
    await pglite.exec(
      fs.readFileSync(path.resolve(process.cwd(), "sql/01_mvp_schema.sql"), "utf-8")
    );
    await pglite.exec(
      fs.readFileSync(
        path.resolve(process.cwd(), "sql/04_v1_phase2_billing_and_credits.sql"),
        "utf-8"
      )
    );
    await pglite.exec(
      fs.readFileSync(path.resolve(process.cwd(), "sql/05_v1_phase3_gamification.sql"), "utf-8")
    );
    await pglite.exec(
      fs.readFileSync(
        path.resolve(process.cwd(), "supabase/migrations/20260712000000_v1_unlockable_content.sql"),
        "utf-8"
      )
    );
    await pglite.exec(
      fs.readFileSync(
        path.resolve(process.cwd(), "supabase/migrations/20260716000000_v2_narrative_content_points.sql"),
        "utf-8"
      )
    );

    // Popolamento dati test: Famiglia, 2 Bambini (Leo con 50 pt, Marco con 10 pt), Contenuto Narrativo
    await pglite.exec(`
      INSERT INTO auth.users (id) VALUES ('11111111-1111-1111-1111-111111111111');

      INSERT INTO public.families (id, parent_user_id, subscription_tier)
      VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'premium');

      INSERT INTO public.child_profiles (id, family_id, name, adventure_points)
      VALUES 
        ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Leo', 50),
        ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'Marco', 10);

      INSERT INTO public.narrative_content_catalog (id, name, content_type, description, icon_preset, price_cents, is_active, cost_points)
      VALUES ('55555555-5555-5555-5555-555555555555', 'Tratto Coraggioso', 'CHARACTER_TRAIT', 'Il protagonista affronta ogni sfida con eroismo.', 'shield', 199, true, 40)
      ON CONFLICT (id) DO UPDATE SET cost_points = 40;
    `);

    // Costruzione adminClient PGlite per test API
    const makeClient = () => {
      const buildQuery = (table: string) => {
        let selectCols = "*";
        let whereClauses: string[] = [];
        let orderClause = "";

        const chain = {
          select: (cols = "*") => {
            selectCols = cols;
            return chain;
          },
          eq: (col: string, val: any) => {
            const formatted = typeof val === "string" ? `'${val}'` : val;
            whereClauses.push(`${col} = ${formatted}`);
            return chain;
          },
          order: (col: string, { ascending }: { ascending?: boolean } = {}) => {
            orderClause = `ORDER BY ${col} ${ascending !== false ? "ASC" : "DESC"}`;
            return chain;
          },
          single: async () => {
            const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
            const res = await pglite.query(`SELECT ${selectCols} FROM public.${table} ${whereStr} ${orderClause} LIMIT 1`);
            return { data: res.rows[0] || null, error: res.rows[0] ? null : { message: "Not found" } };
          },
          maybeSingle: async () => {
            const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
            const res = await pglite.query(`SELECT ${selectCols} FROM public.${table} ${whereStr} ${orderClause} LIMIT 1`);
            return { data: res.rows[0] || null, error: null };
          },
          update: (data: Record<string, any>) => ({
            eq: async (col: string, val: any) => {
              const setStr = Object.entries(data)
                .map(([k, v]) => `${k} = ${v === null ? "NULL" : typeof v === "boolean" ? v : `'${v}'`}`)
                .join(", ");
              const formattedVal = typeof val === "string" ? `'${val}'` : val;
              await pglite.query(`UPDATE public.${table} SET ${setStr} WHERE ${col} = ${formattedVal}`);
              return { error: null };
            },
          }),
          insert: async (data: Record<string, any>) => {
            const keys = Object.keys(data).join(", ");
            const vals = Object.values(data)
              .map((v) => (v === null ? "NULL" : typeof v === "boolean" ? v : `'${v}'`))
              .join(", ");
            await pglite.query(`INSERT INTO public.${table} (${keys}) VALUES (${vals})`);
            return { error: null };
          },
          then: async (resolve: (val: any) => void) => {
            const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
            const res = await pglite.query(`SELECT ${selectCols} FROM public.${table} ${whereStr} ${orderClause}`);
            resolve({ data: res.rows, error: null });
          },
        };
        return chain;
      };

      return {
        from: (table: string) => buildQuery(table),
      };
    };

    adminClient = makeClient();
  });

  it("1. GET /api/child/gamification restituisce narrativeCatalog e unlockedNarrative vuoto all'inizio", async () => {
    const res = await handleGamificationGetServer(adminClient, "33333333-3333-3333-3333-333333333333");
    const json = await res.json();

    expect(json.child.name).toBe("Leo");
    expect(json.narrativeCatalog.length).toBeGreaterThanOrEqual(1);
    const targetItem = json.narrativeCatalog.find((i: any) => i.id === "55555555-5555-5555-5555-555555555555");
    expect(targetItem).toBeDefined();
    expect(targetItem.cost_points).toBe(40);
    expect(json.unlockedNarrative).toEqual([]);
  });

  it("2. POST /api/child/gamification (unlock_narrative_content) scala i punti e sblocca il contenuto", async () => {
    const res = await handleGamificationActionServer(
      null,
      adminClient,
      {
        action: "unlock_narrative_content",
        childId: "33333333-3333-3333-3333-333333333333",
        contentId: "55555555-5555-5555-5555-555555555555",
      }
    );

    expect(res.status).toBe(200);
    expect(res.success).toBe(true);
    expect(res.adventurePoints).toBe(10); // 50 - 40 = 10 pt
    expect(res.unlockedContentId).toBe("55555555-5555-5555-5555-555555555555");

    // Verifica nel DB
    const getRes = await handleGamificationGetServer(adminClient, "33333333-3333-3333-3333-333333333333");
    const getJson = await getRes.json();
    expect(getJson.child.adventure_points).toBe(10);
    expect(getJson.unlockedNarrative.length).toBe(1);
    expect(getJson.unlockedNarrative[0].content_id).toBe("55555555-5555-5555-5555-555555555555");
  });

  it("3. POST (unlock_narrative_content) respinge sblocco se già sbloccato per questo bambino", async () => {
    const res = await handleGamificationActionServer(
      null,
      adminClient,
      {
        action: "unlock_narrative_content",
        childId: "33333333-3333-3333-3333-333333333333",
        contentId: "55555555-5555-5555-5555-555555555555",
      }
    );

    expect(res.status).toBe(400);
    expect(res.alreadyUnlocked).toBe(true);
    expect(res.error).toContain("Hai già sbloccato questo contenuto");
  });

  it("4. POST (unlock_narrative_content) respinge sblocco per bambino con punti insufficienti", async () => {
    // Marco ha solo 10 punti, mentre il costo è 40
    const res = await handleGamificationActionServer(
      null,
      adminClient,
      {
        action: "unlock_narrative_content",
        childId: "44444444-4444-4444-4444-444444444444",
        contentId: "55555555-5555-5555-5555-555555555555",
      }
    );

    expect(res.status).toBe(400);
    expect(res.insufficientPoints).toBe(true);
    expect(res.error).toContain("Punti Avventura insufficienti");
  });
});
