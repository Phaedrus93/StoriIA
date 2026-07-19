import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { GET as gamificationGET, POST as gamificationPOST } from "@/app/api/admin/gamification/route";
import { GET as presetStoriesGET, POST as presetStoriesPOST } from "@/app/api/admin/preset-stories/route";
import { GET as unlockedContentGET } from "@/app/api/family/unlocked-content/route";
import { POST as avatarPresetsPOST, PUT as avatarPresetsPUT } from "@/app/api/admin/avatar-presets/route";

let dbInstance: PGlite | null = null;

const createPGliteSupabaseAdapter = (pglite: PGlite) => ({
  auth: {
    getUser: async () => {
      const res = await pglite.query(`SELECT * FROM auth.users WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55' LIMIT 1`);
      const row = res.rows[0] as any;
      return {
        data: {
          user: row ? { id: row.id, email: row.email || "parent.batch1@example.com", app_metadata: { role: "admin" } } : null,
        },
        error: null,
      };
    },
  },
  from: (table: string) => {
    let whereClauses: string[] = [];
    let orderClause = "";
    return {
      select: (_cols?: string) => ({
        eq: function (col: string, val: any) {
          const formattedVal = typeof val === "string" ? `'${String(val).replace(/'/g, "''")}'` : val;
          whereClauses.push(`${col} = ${formattedVal}`);
          return this;
        },
        in: function (col: string, vals: any[]) {
          const formattedVals = vals.map((v) => (typeof v === "string" ? `'${String(v).replace(/'/g, "''")}'` : v)).join(", ");
          whereClauses.push(`${col} IN (${formattedVals})`);
          return this;
        },
        order: function (col: string, opts: { ascending: boolean }) {
          orderClause = `ORDER BY ${col} ${opts.ascending ? "ASC" : "DESC"}`;
          return this;
        },
        single: async () => {
          const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
          try {
            const res = await pglite.query(`SELECT * FROM public.${table} ${whereStr} LIMIT 1`);
            return { data: res.rows[0] || null, error: res.rows[0] ? null : { message: "Not found" } };
          } catch (err: any) {
            return { data: null, error: { message: err.message || "Select error" } };
          }
        },
        then: async (resolve: (val: any) => void, _reject?: (err: any) => void) => {
          const whereStr = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";
          try {
            const res = await pglite.query(`SELECT * FROM public.${table} ${whereStr} ${orderClause}`);
            resolve({ data: res.rows, count: res.rows.length, error: null });
          } catch (err: any) {
            resolve({ data: null, count: 0, error: { message: err?.message || String(err) } });
          }
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
                .map((v) => (v === null ? "NULL" : typeof v === "boolean" || typeof v === "number" ? v : typeof v === "object" ? `'${JSON.stringify(v).replace(/'/g, "''")}'` : `'${String(v).replace(/'/g, "''")}'`))
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
      update: (data: Record<string, any>) => {
        let whereStr = "";
        return {
          eq: function (col: string, val: any) {
            const formattedVal = typeof val === "string" ? `'${String(val).replace(/'/g, "''")}'` : val;
            whereStr = `WHERE ${col} = ${formattedVal}`;
            const executeUpdate = async () => {
              const setStr = Object.entries(data)
                .map(([k, v]) => `${k} = ${v === null ? "NULL" : typeof v === "boolean" || typeof v === "number" ? v : typeof v === "object" ? `'${JSON.stringify(v).replace(/'/g, "''")}'` : `'${String(v).replace(/'/g, "''")}'`}`)
                .join(", ");
              try {
                const res = await pglite.query(`UPDATE public.${table} SET ${setStr} ${whereStr} RETURNING *`);
                return { data: res.rows, error: null };
              } catch (err: any) {
                return { data: null, error: { message: err.message || "Update error" } };
              }
            };
            return {
              select: (_cols?: string) => ({
                single: async () => {
                  const result = await executeUpdate();
                  if (result.error) return { data: null, error: result.error };
                  return { data: result.data?.[0] || null, error: result.data?.[0] ? null : { message: "Not found" } };
                },
              }),
              then: async (resolve: (val: any) => void) => {
                const result = await executeUpdate();
                resolve(result);
              },
            };
          },
        };
      },
      delete: () => ({
        eq: async (col: string, val: any) => {
          const formattedVal = typeof val === "string" ? `'${String(val).replace(/'/g, "''")}'` : val;
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

vi.mock("@/lib/admin", () => ({
  checkAdminPrivileges: async () => ({ isAdmin: true, error: null }),
  createAdminClient: () => {
    if (!dbInstance) throw new Error("dbInstance not initialized");
    return createPGliteSupabaseAdapter(dbInstance);
  },
}));

describe("StoriIA — Verifica Correzioni BATCH 1 (Admin Gamification, Storie Preset, Unlocked Content, Avatar Presets)", () => {
  let db: PGlite;
  const parentId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55";
  const familyId = "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f55";
  const childId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380c55";

  beforeAll(async () => {
    db = new PGlite();
    dbInstance = db;
    process.env.NODE_ENV = "test";

    await db.exec(`
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE service_role NOLOGIN;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT);
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$
        SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
      $$;

      CREATE SCHEMA IF NOT EXISTS storage;
      CREATE TABLE IF NOT EXISTS storage.buckets (id TEXT PRIMARY KEY, name TEXT NOT NULL, public BOOLEAN DEFAULT false);
      CREATE TABLE IF NOT EXISTS storage.objects (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id TEXT, name TEXT, owner UUID, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), last_accessed_at TIMESTAMPTZ DEFAULT now(), metadata JSONB);
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
      INSERT INTO auth.users (id, email) VALUES ('${parentId}', 'parent.batch1@example.com') ON CONFLICT DO NOTHING;
    `);
    await db.query(`
      INSERT INTO public.families (id, parent_user_id, subscription_tier, subscription_status, credits_balance)
      VALUES ('${familyId}', '${parentId}', 'premium', 'active', 50) ON CONFLICT DO NOTHING;
    `);
    await db.query(`
      INSERT INTO public.child_profiles (id, family_id, name, birth_year)
      VALUES ('${childId}', '${familyId}', 'Leo', 2018) ON CONFLICT DO NOTHING;
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("Punto 3: deve permettere ad Admin di salvare e leggere cosmetici con il payload UI (type, icon_value)", async () => {
    const reqPost = new Request("http://localhost/api/admin/gamification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table: "cosmetic_items",
        name: "Badge Coraggio",
        type: "badge",
        cost_points: 100,
        icon_value: "🦁",
      }),
    });
    const resPost = await gamificationPOST(reqPost);
    const dataPost = await resPost.json();

    expect(resPost.status).toBe(200);
    expect(dataPost.success).toBe(true);
    expect(dataPost.item.name).toBe("Badge Coraggio");
    expect(dataPost.item.type).toBe("badge");
    expect(dataPost.item.icon_value).toBe("🦁");

    const reqGet = new Request("http://localhost/api/admin/gamification?type=cosmetic_items");
    const resGet = await gamificationGET(reqGet);
    const dataGet = await resGet.json();

    expect(resGet.status).toBe(200);
    const saved = dataGet.cosmetic_items.find((c: any) => c.name === "Badge Coraggio");
    expect(saved).toBeDefined();
    expect(saved.type).toBe("badge");
    expect(saved.icon_value).toBe("🦁");
  });

  it("Punto 4: deve permettere ad Admin di creare e leggere Storie Preset senza errore 500 (usando source = 'preset')", async () => {
    const reqPost = new Request("http://localhost/api/admin/preset-stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "La Volpe e il Bosco",
        summary: "Una favola di amicizia.",
        content: "C'era una volta una piccola volpe...",
        age_group: "4-6",
      }),
    });
    const resPost = await presetStoriesPOST(reqPost);
    const dataPost = await resPost.json();

    expect(resPost.status).toBe(200);
    expect(dataPost.success).toBe(true);
    expect(dataPost.story.title).toBe("La Volpe e il Bosco");
    expect(dataPost.story.is_preset).toBe(true);

    const reqGet = new Request("http://localhost/api/admin/preset-stories");
    const resGet = await presetStoriesGET();
    const dataGet = await resGet.json();

    expect(resGet.status).toBe(200);
    const found = dataGet.preset_stories.find((s: any) => s.title === "La Volpe e il Bosco");
    expect(found).toBeDefined();
    expect(found.is_preset).toBe(true);
  });

  it("Punto 5: verifica che la colonna display_order su avatar_presets esista e sia interrogabile", async () => {
    const res = await db.query("SELECT id, name, display_order FROM public.avatar_presets LIMIT 1;");
    expect(res.rows).toBeDefined();
  });

  it("Punto 6: deve restituire come isUnlocked=true i contenuti sbloccati nella tabella child_unlocked_content", async () => {
    const traitUuid = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c55";
    await db.query(`
      INSERT INTO public.narrative_content_catalog (id, name, content_type, description, cost_points, is_active)
      VALUES ('${traitUuid}', 'Scudo Magico', 'CHARACTER_TRAIT', 'Protegge da ogni pericolo', 50, true)
      ON CONFLICT DO NOTHING;
    `);

    await db.query(`
      INSERT INTO public.child_unlocked_content (child_profile_id, content_id)
      VALUES ('${childId}', '${traitUuid}')
      ON CONFLICT DO NOTHING;
    `);

    const reqGet = new Request("http://localhost/api/family/unlocked-content");
    const resGet = await unlockedContentGET();
    const dataGet = await resGet.json();

    expect(resGet.status).toBe(200);
    const trait = dataGet.all.find((i: any) => i.id === traitUuid);
    expect(trait).toBeDefined();
    expect(trait.isUnlocked).toBe(true);
  });

  it("deve permettere ad Admin di creare e aggiornare un Avatar Preset con gender, is_active e display_order senza errore di schema cache", async () => {
    const reqPost = new Request("http://localhost/api/admin/avatar-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Mago delle Stelle",
        image_url: "/avatars/wizard.svg",
        gender: "boy",
        is_active: true,
        display_order: 5,
      }),
    });
    const resPost = await avatarPresetsPOST(reqPost);
    const dataPost = await resPost.json();

    expect(resPost.status).toBe(200);
    expect(dataPost.success).toBe(true);
    expect(dataPost.preset.name).toBe("Mago delle Stelle");
    expect(dataPost.preset.gender).toBe("boy");
    expect(dataPost.preset.is_active).toBe(true);

    const reqPut = new Request("http://localhost/api/admin/avatar-presets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: dataPost.preset.id,
        name: "Mago Supremo",
        gender: "neutral",
        display_order: 1,
      }),
    });
    const resPut = await avatarPresetsPUT(reqPut);
    const dataPut = await resPut.json();

    expect(resPut.status).toBe(200);
    expect(dataPut.success).toBe(true);
    expect(dataPut.preset.name).toBe("Mago Supremo");
    expect(dataPut.preset.gender).toBe("neutral");
  });
});
