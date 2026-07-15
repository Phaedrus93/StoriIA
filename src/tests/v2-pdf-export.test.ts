import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { GET as getStoryPDF } from "@/app/api/stories/[id]/pdf/route";
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
      
      // Decodifica operatori TJ (es. [<4c6120> 80 <56> 90 <6f6c7065...>] TJ) o Tj (es. <4c6120> Tj)
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
      // Ignora stream non zlib o binari diversi
    }
  }
  return uncompressedText;
}

let dbInstance: PGlite | null = null;
let currentTestUserId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55"; // Default: Genitore titolare

const createPGliteSupabaseAdapter = (pglite: PGlite) => ({
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
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (!dbInstance) throw new Error("dbInstance not initialized");
    return createPGliteSupabaseAdapter(dbInstance);
  },
}));

describe("StoriIA v2.0 Phase 1 — Export PDF Storie (/api/stories/[id]/pdf)", () => {
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

    // Inserimento Profilo Bambino per la famiglia titolare con nome riconoscibile
    await db.query(`
      INSERT INTO public.child_profiles (id, family_id, name, birth_year)
      VALUES ('${childProfileId}', '${ownerFamilyId}', 'Marco Il Bambino Segreto', 2018);
    `);

    // Inserimento Lezione Morale
    await db.query(`
      INSERT INTO public.moral_lessons (id, label, title, description)
      VALUES ('amicizia_magica', 'Amicizia', 'Il Valore dell Amicizia', 'Aiutare gli amici rende il cuore più grande.');
    `);

    // Inserimento Storia AI (associata alla famiglia titolare e con assegnazione al bambino)
    await db.query(`
      INSERT INTO public.stories (id, family_id, moral_lesson_id, target_age_range, generated_text, source)
      VALUES ('${aiStoryId}', '${ownerFamilyId}', 'amicizia_magica', '4-6', '# La Volpe e il Bosco Incantato\\n\\nC era una volta una piccola volpe che correva felice nel boscoincantato.', 'ai_generated');
    `);

    // Assegnazione della storia al bambino
    await db.query(`
      INSERT INTO public.story_assignments (story_id, child_profile_id, reading_status)
      VALUES ('${aiStoryId}', '${childProfileId}', 'completed');
    `);

    // Inserimento Storia Preset (family_id = NULL)
    await db.query(`
      INSERT INTO public.stories (id, family_id, target_age_range, generated_text, source)
      VALUES ('${presetStoryId}', NULL, '7-10', '# Il Viaggio del Piccolo Drago\\n\\nNel lontano regno delle nuvole viveva un drago curioso di scoprire le stelle.', 'preset');
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("Test 1: Genera e verifica il PDF di una storia ai_generated (header application/pdf, contenuto presente e ASSENZA di dati/identificativi del profilo bambino)", async () => {
    currentTestUserId = ownerParentId; // Genitore proprietario

    const req = new Request(`http://localhost/api/stories/${aiStoryId}/pdf`, { method: "GET" });
    const res = await getStoryPDF(req, { params: Promise.resolve({ id: aiStoryId }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("StoriIA_");
    expect(res.headers.get("Content-Disposition")).toContain("La_Volpe_e_il_Bosco_Incantato.pdf");

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Verifica firma PDF standard (%PDF-)
    const pdfHeader = buffer.subarray(0, 5).toString("ascii");
    expect(pdfHeader).toBe("%PDF-");

    // Decomprimiamo i flussi FlateDecode ed estraiamo tutto il testo in chiaro e grezzo dal PDF
    const pdfText = extractTextFromPDF(buffer);

    // Verifica presenza del titolo nel PDF, dei metadati e della morale
    expect(pdfText).toContain("La Volpe e il Bosco Incantato");
    expect(pdfText).toContain("Fascia d");
    expect(pdfText).toContain("4-6 anni");
    expect(pdfText).toContain("Il Valore dell Amicizia");

    // VERIFICA CRITICA PRIVACY BY DESIGN: Nessun riferimento al nome del bambino o ai suoi ID
    expect(pdfText).not.toContain("Marco Il Bambino Segreto");
    expect(pdfText).not.toContain("Marco");
    expect(pdfText).not.toContain(childProfileId);
  });

  it("Test 2: Verifica che per una storia preset (family_id = NULL) QUALUNQUE genitore autenticato (anche diverso da chi l'ha letta) possa scaricare il PDF", async () => {
    currentTestUserId = otherParentId; // Genitore di un'altra famiglia

    const req = new Request(`http://localhost/api/stories/${presetStoryId}/pdf`, { method: "GET" });
    const res = await getStoryPDF(req, { params: Promise.resolve({ id: presetStoryId }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("Il_Viaggio_del_Piccolo_Drago.pdf");

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("Test 3: Verifica che la richiesta del PDF di una storia ai_generated da parte di un genitore DI UN'ALTRA FAMIGLIA venga rifiutata con 403", async () => {
    currentTestUserId = otherParentId; // Genitore non proprietario

    const req = new Request(`http://localhost/api/stories/${aiStoryId}/pdf`, { method: "GET" });
    const res = await getStoryPDF(req, { params: Promise.resolve({ id: aiStoryId }) });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Accesso negato: il documento appartiene a un'altra famiglia");
  });
});
