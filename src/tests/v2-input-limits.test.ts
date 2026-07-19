import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { POST as charactersPOST } from "@/app/api/characters/route";
import { POST as settingsPOST } from "@/app/api/settings/route";
import { POST as generateStoryPOST } from "@/app/api/generate-story/route";

let dbInstance: PGlite | null = null;

const createPGliteSupabaseAdapter = (pglite: PGlite) => ({
  auth: {
    getUser: async () => {
      const res = await pglite.query(`SELECT * FROM auth.users WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55' LIMIT 1`);
      const row = res.rows[0] as any;
      return {
        data: {
          user: row ? { id: row.id, email: row.email || "parent.limits@example.com", app_metadata: {} } : null,
        },
        error: null,
      };
    },
  },
  from: (table: string) => {
    let whereClauses: string[] = [];
    return {
      select: (_cols?: string) => ({
        eq: function (col: string, val: any) {
          const formattedVal = typeof val === "string" ? `'${val}'` : val;
          whereClauses.push(`${col} = ${formattedVal}`);
          return this;
        },
        single: async () => {
          const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
          const res = await pglite.query(`SELECT * FROM public.${table} ${whereStr} LIMIT 1`);
          return { data: res.rows[0] || null, error: res.rows[0] ? null : { message: "Not found" } };
        },
      }),
      insert: (data: Record<string, any>) => ({
        select: (_cols = "*") => ({
          single: async () => {
            const colsList = Object.keys(data).join(", ");
            const valsList = Object.values(data)
              .map((v) => (v === null ? "NULL" : typeof v === "boolean" || typeof v === "number" ? v : typeof v === "object" ? `'${JSON.stringify(v)}'` : `'${v}'`))
              .join(", ");
            try {
              const res = await pglite.query(`INSERT INTO public.${table} (${colsList}) VALUES (${valsList}) RETURNING *`);
              return { data: res.rows[0] || null, error: null };
            } catch (err: any) {
              return { data: null, error: { message: err.message || "Insert error" } };
            }
          },
        }),
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

vi.mock("@/lib/ai/story-generator", () => ({
  moderateTextWithAI: async () => ({ safe: true }),
  isDailyRateLimitExceeded: () => false,
  generateStoryWithGemini: async () => "# Storia di test\nContenuto generato.",
}));

describe("StoriIA — Verifica Limiti Caratteri Input Verso il Prompt AI (BATCH 1 Punto 1)", () => {
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

    const migrationsDir = path.join(process.cwd(), "supabase/migrations");
    const files = fs.readdirSync(migrationsDir).sort();
    for (const file of files) {
      if (file.endsWith(".sql")) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
        await db.exec(sql);
      }
    }

    await db.query(`
      INSERT INTO auth.users (id, email) VALUES ('${parentId}', 'parent.limits@example.com') ON CONFLICT DO NOTHING;
    `);
    await db.query(`
      INSERT INTO public.families (id, parent_user_id, subscription_tier, subscription_status, credits_balance)
      VALUES ('${familyId}', '${parentId}', 'premium', 'active', 50)
      ON CONFLICT DO NOTHING;
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("deve rifiutare con status 400 un personaggio con nome > 50 caratteri o tratti > 300 caratteri", async () => {
    const longName = "A".repeat(51);
    const reqName = new Request("http://localhost/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: longName, traits: "Tratti normali" }),
    });
    const resName = await charactersPOST(reqName);
    const dataName = await resName.json();

    expect(resName.status).toBe(400);
    expect(dataName.error).toContain("limite massimo di 50 caratteri");

    const longTraits = "B".repeat(301);
    const reqTraits = new Request("http://localhost/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Drago", traits: longTraits }),
    });
    const resTraits = await charactersPOST(reqTraits);
    const dataTraits = await resTraits.json();

    expect(resTraits.status).toBe(400);
    expect(dataTraits.error).toContain("limite massimo di 300 caratteri");
  });

  it("deve rifiutare con status 400 un'ambientazione con nome > 50 caratteri o descrizione > 300 caratteri", async () => {
    const longDesc = "C".repeat(301);
    const reqDesc = new Request("http://localhost/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Foresta", description: longDesc }),
    });
    const resDesc = await settingsPOST(reqDesc);
    const dataDesc = await resDesc.json();

    expect(resDesc.status).toBe(400);
    expect(dataDesc.error).toContain("limite massimo di 300 caratteri");
  });

  it("deve rifiutare con status 400 la generazione di una storia con campi prompt che superano i limiti consentiti", async () => {
    const reqStory = new Request("http://localhost/api/generate-story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ageRange: "4-6",
        characterName: "Drago",
        characterTraits: "D".repeat(301),
        settingName: "Castello",
      }),
    });
    const resStory = await generateStoryPOST(reqStory);
    const dataStory = await resStory.json();

    expect(resStory.status).toBe(400);
    expect(dataStory.error).toContain("limite massimo di 300 caratteri");
  });
});
