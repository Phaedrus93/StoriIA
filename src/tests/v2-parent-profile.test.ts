import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

let currentMockUser: { id: string; email: string; app_metadata?: any } | null = null;
let db: PGlite;

const userId = "a1111111-1111-1111-1111-111111111111";
const familyId = "f1111111-1111-1111-1111-111111111111";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => makeMockClient(),
}));

function makeMockClient() {
  return {
    auth: {
      getUser: async () => ({
        data: { user: currentMockUser },
        error: currentMockUser ? null : { message: "Non autenticato" },
      }),
    },
    from: (table: string) => makeQueryBuilder(table),
  };
}

function makeQueryBuilder(table: string) {
  let filters: Record<string, any> = {};
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
    single: async () => {
      const whereClauses = Object.entries(filters).map(([k, v]) => {
        if (v === null) return `${k} IS NULL`;
        if (typeof v === "string") return `${k} = '${v}'`;
        return `${k} = ${v}`;
      });
      const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
      const query = `SELECT ${colsToSelect} FROM public.${table} ${whereStr} LIMIT 1`;
      const res = await db.query(query);
      if (res.rows.length === 0) {
        return { data: null, error: { message: "Row not found" } };
      }
      return { data: res.rows[0], error: null };
    },
    maybeSingle: async () => {
      const whereClauses = Object.entries(filters).map(([k, v]) => {
        if (v === null) return `${k} IS NULL`;
        if (typeof v === "string") return `${k} = '${v}'`;
        return `${k} = ${v}`;
      });
      const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
      const query = `SELECT ${colsToSelect} FROM public.${table} ${whereStr} LIMIT 1`;
      const res = await db.query(query);
      if (res.rows.length === 0) {
        return { data: null, error: null };
      }
      return { data: res.rows[0], error: null };
    },
    update: (payload: Record<string, any>) => {
      const setClauses = Object.entries(payload).map(([k, v]) => {
        if (v === null) return `${k} = NULL`;
        if (typeof v === "string") return `${k} = '${v}'`;
        return `${k} = ${v}`;
      });
      const updateChain: any = {
        eq: (col: string, val: any) => {
          filters[col] = val;
          return updateChain;
        },
        select: (cols: string = "*") => {
          colsToSelect = cols;
          return updateChain;
        },
        single: async () => {
          const whereClauses = Object.entries(filters).map(([k, v]) => {
            if (v === null) return `${k} IS NULL`;
            if (typeof v === "string") return `${k} = '${v}'`;
            return `${k} = ${v}`;
          });
          const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
          const sql = `UPDATE public.${table} SET ${setClauses.join(", ")} ${whereStr} RETURNING ${colsToSelect}`;
          const res = await db.query(sql);
          if (res.rows.length === 0) {
            return { data: null, error: { message: "Update failed" } };
          }
          return { data: res.rows[0], error: null };
        },
      };
      return updateChain;
    },
  };
  return chain;
}

import { GET, PUT } from "@/app/api/family/profile/route";

describe("StoriIA — V2 Fase 13.1: Profilo Genitore & Cosmetici per Genitori", () => {
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

    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/01_mvp_schema.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/04_v1_phase2_billing_and_credits.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/05_v1_phase3_gamification.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260722300000_v2_parent_profile_and_cosmetics.sql"), "utf-8"));

    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${userId}', 'parent.guida@example.com');
      INSERT INTO public.families (id, parent_user_id, subscription_tier)
      VALUES ('${familyId}', '${userId}', 'premium');
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("1. GET /api/family/profile restituisce i valori di default per un nuovo genitore", async () => {
    currentMockUser = { id: userId, email: "parent.guida@example.com" };

    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.profile.email).toBe("parent.guida@example.com");
    expect(data.profile.parent_display_name).toBe("Genitore StoriIA");
    expect(data.profile.parent_role).toBe("Genitore");
    expect(data.profile.parent_avatar_preset_id).toBeNull();
  });

  it("2. PUT /api/family/profile aggiorna nome, ruolo e preset avatar del genitore", async () => {
    currentMockUser = { id: userId, email: "parent.guida@example.com" };

    const req = new Request("http://localhost/api/family/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_display_name: "Mamma Laura",
        parent_role: "Mamma",
        parent_avatar_preset_id: "parent-preset-queen",
      }),
    });

    const res = await PUT(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.profile.parent_display_name).toBe("Mamma Laura");
    expect(data.profile.parent_role).toBe("Mamma");
    expect(data.profile.parent_avatar_preset_id).toBe("parent-preset-queen");

    const getRes = await GET();
    const getData = await getRes.json();
    expect(getData.profile.parent_display_name).toBe("Mamma Laura");
    expect(getData.profile.parent_role).toBe("Mamma");
    expect(getData.profile.preset.name).toBe("Regina della Luce");
  });

  it("3. PUT /api/family/profile nega l'accesso se invocato in Modalità Bambino", async () => {
    currentMockUser = { id: userId, email: "parent.guida@example.com", app_metadata: { is_child_mode: true } };

    const req = new Request("http://localhost/api/family/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent_display_name: "Tentativo Non Autorizzato",
      }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(403);
  });
});
