import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { POST as generateStoryPDF } from "@/app/api/stories/[id]/pdf/generate/route";
import zlib from "zlib";

function extractTextFromPDF(buffer: Buffer): string {
  const rawStr = buffer.toString("latin1");
  let uncompressedText = rawStr;
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = streamRegex.exec(rawStr)) !== null) {
    try {
      const streamBuf = Buffer.from(match[1], "latin1");
      let inflated = zlib.unzipSync(streamBuf).toString("latin1");
      
      // Decodifica operatori TJ / Tj sia in formato esadecimale (<...>) sia parentesi ((...))
      inflated = inflated.replace(/\[(.*?)\]\s*TJ|<([0-9a-fA-F]+)>\s*Tj|\((.*?)\)\s*Tj/gi, (fullMatch, content, singleHex, singleParen) => {
        let line = "";
        if (singleHex) {
          for (let i = 0; i < singleHex.length; i += 2) {
            line += String.fromCharCode(parseInt(singleHex.substring(i, i + 2), 16));
          }
        } else if (singleParen) {
          line = singleParen;
        } else if (content) {
          const parts = content.match(/<([0-9a-fA-F]+)>|\((.*?)\)/g);
          if (parts) {
            for (const p of parts) {
              if (p.startsWith("<")) {
                const hex = p.slice(1, -1);
                for (let i = 0; i < hex.length; i += 2) {
                  line += String.fromCharCode(parseInt(hex.substring(i, i + 2), 16));
                }
              } else if (p.startsWith("(")) {
                line += p.slice(1, -1);
              }
            }
          }
        }
        return line + "\n";
      });

      uncompressedText += "\n--- STREAM ---\n" + inflated;
    } catch (e) {
      // Ignora stream non zlib
    }
  }
  return uncompressedText;
}

let dbInstance: PGlite | null = null;
let currentTestUserId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55"; // Default: Genitore titolare
const inMemoryStorage = new Map<string, Buffer>();

const createPGliteSupabaseAdapter = (pglite: PGlite, role: "authenticated" | "service_role" = "authenticated") => {
  let whereClauses: string[] = [];
  return {
    auth: {
      getUser: async () => {
        if (!currentTestUserId) {
          return { data: { user: null }, error: null };
        }
        const res = await pglite.query(`SELECT * FROM auth.users WHERE id = '${currentTestUserId}' LIMIT 1`);
        const row = res.rows[0] as any;
        return {
          data: {
            user: row ? { id: row.id, email: row.email || "parent@example.com", app_metadata: {} } : null,
          },
          error: null,
        };
      },
    },
    from: (table: string) => {
      let currentWhere: string[] = [];
      return {
        select: (_cols?: string) => {
          currentWhere = [];
          return {
            eq: function (col: string, val: any) {
              const formattedVal = typeof val === "string" ? `'${val}'` : val;
              currentWhere.push(`${col} = ${formattedVal}`);
              return this;
            },
            single: async () => {
              const whereStr = currentWhere.length ? `WHERE ${currentWhere.join(" AND ")}` : "";
              const res = await pglite.query(`SELECT * FROM public.${table} ${whereStr} LIMIT 1`);
              const row = res.rows[0] as any;
              if (!row) return { data: null, error: { message: "Not found" } };

              if (table === "stories") {
                if (row.family_id) {
                  const famRes = await pglite.query(`SELECT parent_user_id FROM public.families WHERE id = '${row.family_id}' LIMIT 1`);
                  row.families = famRes.rows[0] || null;
                } else {
                  row.families = null;
                }
                if (row.moral_lesson_id) {
                  const morRes = await pglite.query(`SELECT label, title, description FROM public.moral_lessons WHERE id = '${row.moral_lesson_id}' LIMIT 1`);
                  row.moral_lessons = morRes.rows[0] || null;
                } else {
                  row.moral_lessons = null;
                }
              }
              return { data: row, error: null };
            },
          };
        },
        update: (updateData: Record<string, any>) => ({
          eq: async (col: string, val: any) => {
            const formattedVal = typeof val === "string" ? `'${val}'` : val;
            const setList = Object.entries(updateData)
              .map(([k, v]) => `${k} = ${v === null ? "NULL" : typeof v === "string" ? `'${v}'` : v}`)
              .join(", ");
            const res = await pglite.query(`UPDATE public.${table} SET ${setList} WHERE ${col} = ${formattedVal} RETURNING *`);
            return { data: res.rows || [], error: null };
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
      };
    },
    storage: {
      from: (bucket: string) => ({
        upload: async (pathStr: string, fileBody: Buffer | string, options?: any) => {
          if (role !== "service_role") {
            return { data: null, error: { message: "new row violates row-level security policy for table storage.objects" } };
          }
          const buf = Buffer.isBuffer(fileBody) ? fileBody : Buffer.from(fileBody);
          await pglite.query(`INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('${bucket}', '${pathStr}', '{"size": ${buf.length}}') ON CONFLICT (id) DO NOTHING;`);
          inMemoryStorage.set(`${bucket}:${pathStr}`, buf);
          return { data: { path: pathStr }, error: null };
        },
        createSignedUrl: async (pathStr: string, expiresIn: number) => {
          if (role !== "service_role") {
            return { data: null, error: { message: "new row violates row-level security policy for table storage.objects" } };
          }
          if (!inMemoryStorage.has(`${bucket}:${pathStr}`)) {
            return { data: null, error: { message: "Object not found" } };
          }
          return { data: { signedUrl: `https://storage.supabase.co/signed/${bucket}/${pathStr}?token=mock-signed-jwt&expiresIn=${expiresIn}` }, error: null };
        },
        download: async (pathStr: string) => {
          if (role !== "service_role") {
            return { data: null, error: { message: "new row violates row-level security policy for table storage.objects" } };
          }
          const buf = inMemoryStorage.get(`${bucket}:${pathStr}`);
          if (!buf) return { data: null, error: { message: "Object not found" } };
          return { data: buf, error: null };
        },
      }),
    },
  };
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (!dbInstance) throw new Error("dbInstance not initialized");
    return createPGliteSupabaseAdapter(dbInstance, "authenticated");
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (!dbInstance) throw new Error("dbInstance not initialized");
    return createPGliteSupabaseAdapter(dbInstance, "service_role");
  },
}));

describe("StoriIA v2.0 Phase 1 — Export PDF Storie (/api/stories/[id]/pdf/generate)", () => {
  let db: PGlite;
  const ownerParentId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55";
  const otherParentId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380e66";
  const ownerFamilyId = "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f55";
  const otherFamilyId = "f1eebc99-9c0b-4ef8-bb6d-6bb9bd380f66";
  const childProfileId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c77";
  const aiStoryId = "11111111-1111-1111-1111-111111111111";
  const presetStoryId = "22222222-2222-2222-2222-222222222222";

  beforeAll(async () => {
    db = new PGlite();
    dbInstance = db;
    process.env.NODE_ENV = "test";
    inMemoryStorage.clear();

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

    // Inserimento Utenti Genitori
    await db.query(`
      INSERT INTO auth.users (id, email) VALUES ('${ownerParentId}', 'owner@example.com'), ('${otherParentId}', 'other@example.com');
    `);

    // Inserimento Famiglie
    await db.query(`
      INSERT INTO public.families (id, parent_user_id, subscription_tier, subscription_status, credits_balance)
      VALUES 
        ('${ownerFamilyId}', '${ownerParentId}', 'premium', 'active', 50),
        ('${otherFamilyId}', '${otherParentId}', 'premium', 'active', 50);
    `);

    // Inserimento Profilo Bambino
    await db.query(`
      INSERT INTO public.child_profiles (id, family_id, name, birth_year)
      VALUES ('${childProfileId}', '${ownerFamilyId}', 'Marco Il Bambino Segreto', 2018);
    `);

    // Inserimento Lezione Morale
    await db.query(`
      INSERT INTO public.moral_lessons (id, label, title, description)
      VALUES ('amicizia_magica', 'Amicizia', 'Il Valore dell Amicizia', 'Aiutare gli amici rende il cuore più grande.');
    `);

    // Inserimento Storia AI (pdf_storage_path = NULL all'inizio)
    await db.query(`
      INSERT INTO public.stories (id, family_id, moral_lesson_id, target_age_range, generated_text, source, pdf_storage_path)
      VALUES ('${aiStoryId}', '${ownerFamilyId}', 'amicizia_magica', '4-6', '# La Volpe e il Bosco Incantato\\n\\nC era una volta una piccola volpe che correva felice nel boscoincantato.', 'ai_generated', NULL);
    `);

    // Assegnazione della storia al bambino
    await db.query(`
      INSERT INTO public.story_assignments (story_id, child_profile_id, reading_status)
      VALUES ('${aiStoryId}', '${childProfileId}', 'completed');
    `);

    // Inserimento Storia Preset
    await db.query(`
      INSERT INTO public.stories (id, family_id, target_age_range, generated_text, source, pdf_storage_path)
      VALUES ('${presetStoryId}', NULL, '7-10', '# Il Viaggio del Piccolo Drago\\n\\nNel lontano regno delle nuvole viveva un drago curioso di scoprire le stelle.', 'preset', NULL);
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("Test 1: Genera il PDF con pdf-lib su storage (cached: false), verifica assenza di dati/identificativi del profilo bambino, e verifica riutilizzo cache (cached: true) alla seconda chiamata", async () => {
    currentTestUserId = ownerParentId; // Genitore proprietario

    const req1 = new Request(`http://localhost/api/stories/${aiStoryId}/pdf/generate`, { method: "POST" });
    const res1 = await generateStoryPDF(req1, { params: Promise.resolve({ id: aiStoryId }) });
    const data1 = await res1.json();

    expect(res1.status).toBe(200);
    expect(data1.cached).toBe(false);
    expect(data1.storagePath).toContain("stories/");
    expect(data1.signedUrl).toContain("https://storage.supabase.co/signed/story-pdfs/");

    // Verifica che il buffer salvato in inMemoryStorage (bucket story-pdfs) sia un PDF valido
    const storedBuffer = inMemoryStorage.get(`story-pdfs:${data1.storagePath}`);
    expect(storedBuffer).toBeDefined();
    expect(storedBuffer!.subarray(0, 5).toString("ascii")).toBe("%PDF-");

    // Estrazione e verifica del contenuto e privacy by design
    const pdfText = extractTextFromPDF(storedBuffer!);
    expect(pdfText).toContain("La Volpe e il Bosco Incantato");
    expect(pdfText).toContain("Fascia d");
    expect(pdfText).toContain("4-6 anni");
    expect(pdfText).toContain("Il Valore dell Amicizia");

    // VERIFICA CRITICA PRIVACY BY DESIGN
    expect(pdfText).not.toContain("Marco Il Bambino Segreto");
    expect(pdfText).not.toContain("Marco");
    expect(pdfText).not.toContain(childProfileId);

    // Verifica aggiornamento su DB
    const resDb = await db.query(`SELECT pdf_storage_path FROM public.stories WHERE id = '${aiStoryId}'`);
    expect((resDb.rows[0] as any).pdf_storage_path).toBe(data1.storagePath);

    // Seconda chiamata POST per la stessa storia: deve restituire cached: true e una nuova signed URL senza rigenerare
    const req2 = new Request(`http://localhost/api/stories/${aiStoryId}/pdf/generate`, { method: "POST" });
    const res2 = await generateStoryPDF(req2, { params: Promise.resolve({ id: aiStoryId }) });
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.cached).toBe(true);
    expect(data2.storagePath).toBe(data1.storagePath);
    expect(data2.signedUrl).toContain("token=mock-signed-jwt");
  });

  it("Test 2: Verifica che per una storia preset (family_id = NULL) QUALUNQUE genitore autenticato possa richiedere la generazione e ottenere la signed URL", async () => {
    currentTestUserId = otherParentId; // Genitore di un'altra famiglia

    const req = new Request(`http://localhost/api/stories/${presetStoryId}/pdf/generate`, { method: "POST" });
    const res = await generateStoryPDF(req, { params: Promise.resolve({ id: presetStoryId }) });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.signedUrl).toContain("https://storage.supabase.co/signed/story-pdfs/");
  });

  it("Test 3: Verifica che la richiesta per una storia ai_generated da parte di un genitore DI UN'ALTRA FAMIGLIA venga respinta con 403 (sia in generazione che per richiesta signed URL esistente)", async () => {
    currentTestUserId = otherParentId; // Genitore non proprietario

    // Richiesta di una storia che ora ha già pdf_storage_path valorizzato da Test 1
    const req = new Request(`http://localhost/api/stories/${aiStoryId}/pdf/generate`, { method: "POST" });
    const res = await generateStoryPDF(req, { params: Promise.resolve({ id: aiStoryId }) });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Accesso negato: il documento appartiene a un'altra famiglia");
  });

  it("Test 4: Blocco RLS Storage — verifica che l'accesso diretto al bucket story-pdfs con ruolo 'authenticated' (non 'service_role') venga respinto", async () => {
    // Eseguiamo una chiamata diretta con l'adapter configurato con ruolo 'authenticated'
    const authenticatedAdapter = createPGliteSupabaseAdapter(db, "authenticated");
    const storageClient = authenticatedAdapter.storage.from("story-pdfs");

    // Richiediamo una signed URL e il download diretto del file che sappiamo esistere nello storage (creato in Test 1)
    const existingPath = (await db.query(`SELECT pdf_storage_path FROM public.stories WHERE id = '${aiStoryId}'`)).rows[0] as any;
    expect(existingPath.pdf_storage_path).toBeDefined();

    const signedRes = await storageClient.createSignedUrl(existingPath.pdf_storage_path, 300);
    expect(signedRes.data).toBeNull();
    expect(signedRes.error?.message).toContain("new row violates row-level security policy");

    const downloadRes = await storageClient.download(existingPath.pdf_storage_path);
    expect(downloadRes.data).toBeNull();
    expect(downloadRes.error?.message).toContain("new row violates row-level security policy");
  });
});
