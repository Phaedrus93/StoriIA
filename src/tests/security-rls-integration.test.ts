import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

/**
 * Test di integrazione reale contro il motore PostgreSQL 16 (PGlite in-memory).
 * Verifica che il database (Postgres SQL engine + RLS policies) applichi fisicamente
 * le restrizioni di sicurezza e neghi INSERT/UPDATE/DELETE non autorizzati.
 */

describe("Integration Test — PostgreSQL RLS Engine Real Execution (4-test-integration)", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Creiamo i ruoli Supabase di base (authenticated, anon) e lo schema auth
    await db.exec(`
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE service_role NOLOGIN;

      CREATE SCHEMA IF NOT EXISTS auth;

      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY
      );

      -- Funzione auth.uid() di Supabase che legge dal parametro di sessione corrente
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;

      -- Funzione auth.jwt() di Supabase che restituisce l'oggetto JSON del JWT corrente
      CREATE OR REPLACE FUNCTION auth.jwt()
      RETURNS JSONB
      LANGUAGE sql STABLE AS $$
        SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
      $$;
    `);

    // 2. Carichiamo ed eseguiamo l'intero schema reale SQL di StoriIA
    const schemaPath = path.resolve(process.cwd(), "sql/01_mvp_schema.sql");
    const sqlSchema = fs.readFileSync(schemaPath, "utf-8");
    await db.exec(sqlSchema);

    // 3. Concediamo i permessi al ruolo authenticated come su Supabase
    await db.exec(`
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      GRANT SELECT ON auth.users TO authenticated;
    `);

    // 4. Inseriamo un utente genitore reale in auth.users
    await db.exec(`
      INSERT INTO auth.users (id)
      VALUES ('11111111-1111-1111-1111-111111111111');
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("deve consentire al genitore (NOT is_child_mode) di creare famiglia, profili e storie su Postgres con ruolo authenticated", async () => {
    await db.transaction(async (tx) => {
      await tx.exec(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
        SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":false}}';
      `);

      // Creazione famiglia
      await tx.exec(`
        INSERT INTO public.families (id, parent_user_id)
        VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');
      `);

      // Creazione profili bambino
      await tx.exec(`
        INSERT INTO public.child_profiles (id, family_id, name)
        VALUES 
          ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222222', 'Sofia'),
          ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', 'Luca');
      `);

      // Creazione di una storia e assegnazione a entrambi i fratelli
      await tx.exec(`
        INSERT INTO public.stories (id, family_id, target_age_range, generated_text)
        VALUES ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', '4-6', 'Cera una volta...');

        INSERT INTO public.story_assignments (story_id, child_profile_id)
        VALUES 
          ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333331'),
          ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333332');
      `);

      const res = await tx.query("SELECT * FROM public.child_profiles;");
      expect(res.rows).toHaveLength(2);
    });
  });

  it("deve FISICAMENTE BLOCCARE una INSERT su characters in Postgres quando is_child_mode = true via RLS", async () => {
    await db.transaction(async (tx) => {
      await tx.exec(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
        SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":true,"active_child_profile_id":"33333333-3333-3333-3333-333333333331"}}';
      `);

      // Il tentativo di inserire un personaggio in modalità bambino deve lanciare un errore RLS
      await expect(
        tx.exec(`
          INSERT INTO public.characters (owner_child_profile_id, family_id, name, traits)
          VALUES ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222222', 'Drago Cattivo', 'Sputa fuoco');
        `)
      ).rejects.toThrow(/row-level security policy/i);
    });
  });

  it("deve FISICAMENTE FILTRARE le query SELECT su story_assignments per active_child_profile_id in modalità bambino", async () => {
    await db.transaction(async (tx) => {
      // 1. Come Sofia (33...31), deve vedere solo l'assegnazione di Sofia (1 riga)
      await tx.exec(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
        SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":true,"active_child_profile_id":"33333333-3333-3333-3333-333333333331"}}';
      `);
      const sofiaAssignments = await tx.query("SELECT * FROM public.story_assignments;");
      expect(sofiaAssignments.rows).toHaveLength(1);
      expect(sofiaAssignments.rows[0].child_profile_id).toBe("33333333-3333-3333-3333-333333333331");

      // 2. Come Luca (33...32), deve vedere solo l'assegnazione di Luca (1 riga)
      await tx.exec(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":true,"active_child_profile_id":"33333333-3333-3333-3333-333333333332"}}';
      `);
      const lucaAssignments = await tx.query("SELECT * FROM public.story_assignments;");
      expect(lucaAssignments.rows).toHaveLength(1);
      expect(lucaAssignments.rows[0].child_profile_id).toBe("33333333-3333-3333-3333-333333333332");
    });
  });

  it("deve consentire l'UPDATE del progresso di lettura (last_read_position) al bambino sulla propria assegnazione ed impedire aggiornamenti ad assegnazioni altrui", async () => {
    await db.transaction(async (tx) => {
      await tx.exec(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
        SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":true,"active_child_profile_id":"33333333-3333-3333-3333-333333333331"}}';
      `);

      // Sofia può aggiornare la propria assegnazione
      await tx.exec(`
        UPDATE public.story_assignments
        SET last_read_position = 50, reading_status = 'in_progress'
        WHERE child_profile_id = '33333333-3333-3333-3333-333333333331';
      `);

      const res = await tx.query(
        "SELECT last_read_position FROM public.story_assignments WHERE child_profile_id = '33333333-3333-3333-3333-333333333331';"
      );
      expect(res.rows[0].last_read_position).toBe(50);

      // Sofia NON DEVE poter aggiornare l'assegnazione di Luca (niente righe aggiornate a causa del filtro RLS)
      const updateLuca = await tx.query(`
        UPDATE public.story_assignments
        SET last_read_position = 99
        WHERE child_profile_id = '33333333-3333-3333-3333-333333333332';
      `);
      expect(updateLuca.affectedRows).toBe(0);
    });
  });

  it("deve IMPEDIRE al ruolo authenticated di leggere la tabella family_security o estrarre l'hash del PIN dal client", async () => {
    await db.transaction(async (tx) => {
      // Come amministratore/database o procedura SECURITY DEFINER salviamo un PIN hash
      await tx.exec(`
        INSERT INTO public.family_security (family_id, parent_pin_hash, pin_failed_attempts)
        VALUES ('22222222-2222-2222-2222-222222222222', 'salt:secretpinhash', 0)
        ON CONFLICT (family_id) DO UPDATE SET parent_pin_hash = EXCLUDED.parent_pin_hash;
      `);

      // Impostiamo il ruolo come utente autenticato client (genitore o bambino)
      await tx.exec(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
        SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":false}}';
      `);

      // Qualsiasi tentativo del client di fare SELECT su family_security deve restituire 0 righe per blocco RLS
      const secRes = await tx.query("SELECT * FROM public.family_security;");
      expect(secRes.rows).toHaveLength(0);

      // E la tabella families non espone più alcuna colonna sensibile del PIN
      const famRes = await tx.query("SELECT * FROM public.families WHERE id = '22222222-2222-2222-2222-222222222222';");
      expect(famRes.rows[0]).not.toHaveProperty("parent_pin_hash");
      expect(famRes.rows[0]).not.toHaveProperty("pin_failed_attempts");
      expect(famRes.rows[0]).not.toHaveProperty("pin_locked_until");
    });
  });

  it("deve RIFIUTARE in set_parent_pin_hash qualsiasi tentativo di impostare il PIN per un family_id diverso dalla propria famiglia", async () => {
    await db.transaction(async (tx) => {
      // Impostiamo il chiamante su auth.uid() = 1111... il cui family_id è 2222...2222
      await tx.exec(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
        SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":false}}';
      `);

      // Tenta di modificare il PIN di una famiglia altrui ('99999999-9999-9999-9999-999999999999')
      await expect(
        tx.query("SELECT public.set_parent_pin_hash('99999999-9999-9999-9999-999999999999', 'salt:hack');")
      ).rejects.toThrow(/Accesso negato: impossibile impostare il PIN per una famiglia non propria/i);
    });
  });

  it("deve RIFIUTARE in record_pin_attempt qualsiasi tentativo di registrare tentativi PIN per un family_id diverso dalla propria famiglia (anche se in modalità bambino)", async () => {
    await db.transaction(async (tx) => {
      // Impostiamo il chiamante in modalità bambino su auth.uid() = 1111... il cui family_id è 2222...2222
      await tx.exec(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
        SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":true,"active_child_profile_id":"33333333-3333-3333-3333-333333333331"}}';
      `);

      // Tenta di manipolare i tentativi di PIN di una famiglia altrui ('99999999-9999-9999-9999-999999999999')
      await expect(
        tx.query("SELECT public.record_pin_attempt('99999999-9999-9999-9999-999999999999', false);")
      ).rejects.toThrow(/Accesso negato: impossibile registrare tentativi PIN per una famiglia non propria/i);
    });
  });
});
