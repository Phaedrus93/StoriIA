import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { handleGamificationActionServer } from "../app/api/child/gamification/route";

describe("StoriIA v1.3 - Gamification 'Punti Avventura' & Ownership Security su Motore DB Reale PGlite", () => {
  let pglite: PGlite;
  let adapter: any;
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
    await pglite.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/01_mvp_schema.sql"), "utf-8"));
    await pglite.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/04_v1_phase2_billing_and_credits.sql"), "utf-8"));
    await pglite.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/05_v1_phase3_gamification.sql"), "utf-8"));
    await pglite.exec(fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260712000000_v1_unlockable_content.sql"), "utf-8"));
    await pglite.exec(fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260712100000_v1_phase4_notifications.sql"), "utf-8"));
    await pglite.exec(fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260712120000_v1_bugfixes_schema.sql"), "utf-8"));

    // Popolamento 2 Famiglie e 2 Bambini (Famiglia A con 30 Punti Avventura e 5 crediti AI)
    await pglite.exec(`
      INSERT INTO auth.users (id) VALUES 
        ('11111111-1111-1111-1111-111111111111'),
        ('99999999-9999-9999-9999-999999999999');

      INSERT INTO public.families (id, parent_user_id, subscription_tier, credits_balance)
      VALUES 
        ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'family', 5),
        ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'free', 5);

      INSERT INTO public.child_profiles (id, family_id, name, adventure_points)
      VALUES 
        ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Leo', 30),
        ('77777777-7777-7777-7777-777777777777', '88888888-8888-8888-8888-888888888888', 'Marco', 10);

      INSERT INTO public.cosmetic_items (id, name, category, cost_points, icon_preset)
      VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Medaglia Esploratore', 'BADGE', 15, 'rocket')
      ON CONFLICT DO NOTHING;
    `);

    // Adapter PGlite per le query del client Supabase
    const makeClient = () => {
      const buildQuery = (table: string) => {
        let selectCols = "*";
        let whereClauses: string[] = [];

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
          single: async () => {
            const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
            const res = await pglite.query(`SELECT ${selectCols} FROM public.${table} ${whereStr} LIMIT 1`);
            return { data: res.rows[0] || null, error: res.rows[0] ? null : { message: "Not found" } };
          },
          maybeSingle: async () => {
            const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
            const res = await pglite.query(`SELECT ${selectCols} FROM public.${table} ${whereStr} LIMIT 1`);
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
          upsert: async (data: Record<string, any>) => {
            const keys = Object.keys(data).join(", ");
            const vals = Object.values(data)
              .map((v) => (v === null ? "NULL" : typeof v === "boolean" ? v : `'${v}'`))
              .join(", ");
            await pglite.query(`INSERT INTO public.${table} (${keys}) VALUES (${vals}) ON CONFLICT DO NOTHING`);
            return { error: null };
          },
          then: async (resolve: (val: any) => void) => {
            const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
            const res = await pglite.query(`SELECT ${selectCols} FROM public.${table} ${whereStr}`);
            resolve({ data: res.rows, error: null });
          },
        };
        return chain;
      };

      return {
        from: (table: string) => buildQuery(table),
        auth: {
          getUser: async () => ({
            data: { user: { id: "11111111-1111-1111-1111-111111111111" } },
            error: null,
          }),
        },
      };
    };

    adapter = makeClient();
    adminClient = makeClient();
  });

  afterAll(async () => {
    await pglite.close();
  });

  it("deve verificare la titolarità (ownership) e rifiutare con 403 azioni su profili di un'altra famiglia", async () => {
    const res = await handleGamificationActionServer(adapter, adminClient, {
      action: "award_reading_points",
      childId: "77777777-7777-7777-7777-777777777777", // Bambino della Famiglia B (utente autenticato è genitore A)
    });

    expect(res.status).toBe(403);
    expect(res.error).toBe("Non autorizzato per questo profilo bambino");
  });

  it("deve assegnare realmente +15 Punti Avventura su PGlite ad una lettura completata ('award_reading_points')", async () => {
    const childId = "33333333-3333-3333-3333-333333333333";

    const res = await handleGamificationActionServer(adapter, adminClient, {
      action: "award_reading_points",
      childId,
    });

    expect(res.status).toBe(200);
    expect(res.success).toBe(true);
    expect(res.adventurePoints).toBe(60); // 30 + 15 lettura + 15 bonus missione

    // Verifica diretta sul database PGlite
    const dbRes = await pglite.query<{ adventure_points: number }>(`
      SELECT adventure_points FROM public.child_profiles WHERE id = '${childId}'
    `);
    expect(dbRes.rows[0].adventure_points).toBe(60);
  });

  it("deve sbloccare un cosmetico sul DB ('unlock_cosmetic') scalandone il costo in punti e inserendo in child_unlocked_cosmetics", async () => {
    const childId = "33333333-3333-3333-3333-333333333333";
    const cosmeticId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // costo 15 in cosmetic_items

    const res = await handleGamificationActionServer(adapter, adminClient, {
      action: "unlock_cosmetic",
      childId,
      cosmeticId,
    });

    expect(res.status).toBe(200);
    expect(res.success).toBe(true);
    expect(res.adventurePoints).toBe(45); // 60 - 15

    // Verifica su tabella child_unlocked_cosmetics
    const unlockRes = await pglite.query<{ count: string }>(`
      SELECT count(*)::text as count FROM public.child_unlocked_cosmetics 
      WHERE child_profile_id = '${childId}' AND cosmetic_id = '${cosmeticId}'
    `);
    expect(Number(unlockRes.rows[0].count)).toBe(1);
  });

  it("deve equipaggiare il cosmetico sbloccato ('set_active_cosmetic') aggiornando active_badge_id su PGlite", async () => {
    const childId = "33333333-3333-3333-3333-333333333333";

    const res = await handleGamificationActionServer(adapter, adminClient, {
      action: "set_active_cosmetic",
      childId,
      slot: "badge",
      cosmeticId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });

    expect(res.status).toBe(200);
    expect(res.success).toBe(true);

    const dbRes = await pglite.query<{ active_badge_id: string }>(`
      SELECT active_badge_id FROM public.child_profiles WHERE id = '${childId}'
    `);
    expect(dbRes.rows[0].active_badge_id).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  });

  it("deve verificare che non esista alcun percorso per convertire Punti Avventura in generazioni o crediti AI illimitati", async () => {
    const childId = "33333333-3333-3333-3333-333333333333";

    // Verifica 1: Tentativo di chiamare un'azione non autorizzata o inesistente di conversione punti -> crediti AI
    const res = await handleGamificationActionServer(adapter, adminClient, {
      action: "convert_points_to_credits",
      childId,
      points: 15,
    });
    expect(res.status).toBe(400);
    expect(res.error).toBe("Azione non supportata");

    // Verifica 2: I crediti della famiglia sono rimasti inalterati (5) dopo tutte le azioni di gamification
    const famRes = await pglite.query<{ credits_balance: number }>(`
      SELECT credits_balance FROM public.families WHERE id = '22222222-2222-2222-2222-222222222222'
    `);
    expect(famRes.rows[0].credits_balance).toBe(5);
  });
});
