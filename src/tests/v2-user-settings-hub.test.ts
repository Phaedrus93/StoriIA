import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { handleChildAccessibilityServer } from "@/app/api/child/accessibility/route";

describe("V2 Phase 3: Area Impostazioni Utente Unificata (/settings) & Accessibilità", () => {
  let db: PGlite;
  const parentId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380e55";
  const otherParentId = "b1ffbc99-9c0b-4ef8-bb6d-6bb9bd380e66";
  const familyId = "f1111111-1111-1111-1111-111111111111";
  const leoId = "c1111111-1111-1111-1111-111111111101";
  const marcoId = "c1111111-1111-1111-1111-111111111102";

  beforeAll(async () => {
    db = new PGlite();

    await db.exec(`
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE service_role NOLOGIN;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);

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

    // Caricamento schema principale
    const schemaPath = path.resolve(process.cwd(), "sql/01_mvp_schema.sql");
    const sqlSchema = fs.readFileSync(schemaPath, "utf-8");
    await db.exec(sqlSchema);

    // Caricamento migrazione accessibilità (colonne + funzione SECURITY DEFINER)
    const accessPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20260717000000_v2_accessibility_settings.sql"
    );
    const sqlAccess = fs.readFileSync(accessPath, "utf-8");
    await db.exec(sqlAccess);

    await db.exec(`
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
      GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated;

      INSERT INTO auth.users (id) VALUES ('${parentId}'), ('${otherParentId}');
      INSERT INTO public.families (id, parent_user_id) VALUES ('${familyId}', '${parentId}');
      INSERT INTO public.child_profiles (id, family_id, name, birth_year)
      VALUES
        ('${leoId}', '${familyId}', 'Leo', 2019),
        ('${marcoId}', '${familyId}', 'Marco', 2015);
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  async function setSession(sub: string, isChildMode: boolean = false, activeChildId: string | null = null) {
    const claims = JSON.stringify({
      sub,
      app_metadata: {
        is_child_mode: isChildMode,
        active_child_profile_id: activeChildId || "",
      },
    });
    await db.exec(`
      SET ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub', '${sub}', false);
      SELECT set_config('request.jwt.claims', '${claims}', false);
    `);
  }

  it("Test 1: Verifica che le colonne di accessibilità esistano su child_profiles e abbiano default corretti", async () => {
    await setSession(parentId, false);
    const res = await db.query(`SELECT night_mode, brightness, contrast, font_size FROM public.child_profiles WHERE id = '${leoId}'`);
    const row = res.rows[0] as any;
    expect(row.night_mode).toBe(false);
    expect(row.brightness).toBe(100);
    expect(row.contrast).toBe(100);
    expect(row.font_size).toBe("medium");
  });

  it("Test 2: update_reading_accessibility dal bambino sul PROPRIO profilo (Successo)", async () => {
    // Impostiamo la sessione del bambino Leo in modalità bambino
    await setSession(parentId, true, leoId);

    // Eseguiamo la funzione per Leo
    await db.query(`
      SELECT public.update_reading_accessibility('${leoId}', true, 85, 125, 'xlarge');
    `);

    // Verifiche
    await setSession(parentId, false);
    const res = await db.query(`SELECT * FROM public.child_profiles WHERE id = '${leoId}'`);
    const row = res.rows[0] as any;
    expect(row.night_mode).toBe(true);
    expect(row.brightness).toBe(85);
    expect(row.contrast).toBe(125);
    expect(row.font_size).toBe("xlarge");
  });

  it("Test 3: update_reading_accessibility dal bambino sul profilo del FRATELLO (Blocco Isolamento)", async () => {
    // Leo in modalità bambino tenta di aggiornare Marco
    await setSession(parentId, true, leoId);

    await expect(
      db.query(`SELECT public.update_reading_accessibility('${marcoId}', true, 50, 150, 'small');`)
    ).rejects.toThrow("Accesso negato in modalità bambino: impossibile modificare le preferenze di un altro profilo (isolamento fratelli).");

    // Verifichiamo che il profilo di Marco sia rimasto intatto ai default
    await setSession(parentId, false);
    const res = await db.query(`SELECT * FROM public.child_profiles WHERE id = '${marcoId}'`);
    const row = res.rows[0] as any;
    expect(row.night_mode).toBe(false);
    expect(row.brightness).toBe(100);
    expect(row.contrast).toBe(100);
    expect(row.font_size).toBe("medium");
  });

  it("Test 4: Endpoint PUT /api/child/accessibility blocca applyToAll=true se in modalità bambino", async () => {
    // Simuliamo chiamata a handleChildAccessibilityServer
    const res = await handleChildAccessibilityServer(null, null, {
      applyToAll: true,
      night_mode: true,
      brightness: 110,
      contrast: 110,
      font_size: "large",
      _mockIsChildMode: true, // Sessione bambino
    });

    expect(res.status).toBe(403);
    expect(res.error).toBe("L'applicazione delle preferenze a tutti i figli è riservata al genitore");
  });

  it("Test 5: Endpoint PUT /api/child/accessibility con applyToAll=true dal Genitore aggiorna tutti i figli", async () => {
    // Prepariamo il mock adminClient che interroga PGlite
    const mockAdminClient = {
      from: (table: string) => ({
        select: (_cols: string) => ({
          eq: (col: string, val: string) => ({
            single: async () => {
              if (table === "families") {
                const r = await db.query(`SELECT id FROM public.families WHERE ${col} = '${val}' LIMIT 1`);
                return { data: r.rows[0] || null, error: null };
              }
              return { data: null, error: { message: "Not found" } };
            },
            then: async (resolve: any) => {
              if (table === "child_profiles") {
                const r = await db.query(`SELECT id FROM public.child_profiles WHERE ${col} = '${val}'`);
                resolve({ data: r.rows, error: null });
              } else {
                resolve({ data: [], error: null });
              }
            },
          }),
        }),
      }),
      rpc: async (fn: string, params: any) => {
        if (fn === "update_reading_accessibility") {
          await setSession(parentId, false); // Genitore
          await db.query(`
            SELECT public.update_reading_accessibility(
              '${params.p_child_profile_id}',
              ${params.p_night_mode ?? 'NULL'},
              ${params.p_brightness ?? 'NULL'},
              ${params.p_contrast ?? 'NULL'},
              ${params.p_font_size ? `'${params.p_font_size}'` : 'NULL'}
            );
          `);
        }
        return { error: null };
      },
    };

    const res = await handleChildAccessibilityServer(null, mockAdminClient, {
      applyToAll: true,
      night_mode: true,
      brightness: 90,
      contrast: 120,
      font_size: "large",
      _mockParentId: parentId, // Sessione genitore
      _mockIsChildMode: false,
    });

    expect(res.success).toBe(true);
    expect(res.updatedAll).toBe(true);

    // Verifica nel database PGlite che sia Leo che Marco siano stati aggiornati alle stesse preferenze
    await setSession(parentId, false);
    const leoRes = await db.query(`SELECT night_mode, brightness, contrast, font_size FROM public.child_profiles WHERE id = '${leoId}'`);
    const marcoRes = await db.query(`SELECT night_mode, brightness, contrast, font_size FROM public.child_profiles WHERE id = '${marcoId}'`);

    expect((leoRes.rows[0] as any).font_size).toBe("large");
    expect((leoRes.rows[0] as any).brightness).toBe(90);
    expect((leoRes.rows[0] as any).night_mode).toBe(true);

    expect((marcoRes.rows[0] as any).font_size).toBe("large");
    expect((marcoRes.rows[0] as any).brightness).toBe(90);
    expect((marcoRes.rows[0] as any).night_mode).toBe(true);
  });

  it("Test 6: Verifica rifiuto cambio PIN in presenza di PIN già impostato quando il PIN attuale fornito è errato", async () => {
    await setSession(parentId, false);
    // 1. Impostiamo un PIN iniziale per la famiglia
    const initialPin = "1234";
    const { hashParentPin, verifyParentPin } = await import("@/lib/security/pin");
    const initialHash = await hashParentPin(initialPin);
    await db.query(`SELECT public.set_parent_pin_hash('${familyId}', '${initialHash}');`);

    // 2. Verifichiamo che la chiamata con PIN attuale errato ('9999') fallisca il controllo
    const statusRes = await db.query(`SELECT pin_hash FROM public.get_lockout_status('${familyId}')`);
    const storedHash = (statusRes.rows[0] as any).pin_hash;
    const wrongPinMatch = await verifyParentPin("9999", storedHash);
    expect(wrongPinMatch).toBe(false);

    // 3. Verifichiamo che con il PIN attuale corretto il controllo abbia successo e permetta il cambio
    const correctPinMatch = await verifyParentPin("1234", storedHash);
    expect(correctPinMatch).toBe(true);

    // Eseguiamo il cambio al nuovo PIN
    const newHash = await hashParentPin("5678");
    await db.query(`SELECT public.set_parent_pin_hash('${familyId}', '${newHash}');`);
    const newStatusRes = await db.query(`SELECT pin_hash FROM public.get_lockout_status('${familyId}')`);
    const newStoredHash = (newStatusRes.rows[0] as any).pin_hash;
    expect(await verifyParentPin("5678", newStoredHash)).toBe(true);
  });

  it("Test 7: Verifica che la query child_profiles in loadAllData lato genitore restituisca correttamente i figli della famiglia", async () => {
    await setSession(parentId, false);
    // Verifichiamo che la query diretta su child_profiles usata in /settings (invece dell'endpoint inesistente /api/family/child-profiles)
    // restituisca correttamente sia Leo che Marco senza errori di RLS
    const res = await db.query(`SELECT id, name FROM public.child_profiles WHERE family_id = '${familyId}' ORDER BY created_at ASC, name ASC`);
    expect(res.rows.length).toBe(2);
    expect((res.rows[0] as any).name).toBe("Leo");
    expect((res.rows[1] as any).name).toBe("Marco");
  });
});
