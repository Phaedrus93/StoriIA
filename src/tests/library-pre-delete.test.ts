import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { evaluatePreDeleteCheck } from "../lib/library/delete-helper";

/**
 * Test per verificare:
 * 1) Identificazione di entità in uso (Personaggi e Ambientazioni) da parte delle storie prima della cancellazione
 * 2) Comportamento ON DELETE SET NULL del database al momento della cancellazione confermata
 * 3) Logica applicativa che valuta se mostrare o meno la modale esplicita di conferma
 */
describe("Character & Setting Builder Pre-Delete Aware & Integrity Verification", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // Setup ruoli base e schema
    await db.exec(`
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE service_role NOLOGIN;
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;
      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$
        SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
      $$;
    `);

    const schemaPath = path.resolve(process.cwd(), "sql/01_mvp_schema.sql");
    const sqlSchema = fs.readFileSync(schemaPath, "utf-8");
    await db.exec(sqlSchema);

    await db.exec(`
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      GRANT SELECT ON auth.users TO authenticated;
    `);

    await db.exec(`
      INSERT INTO auth.users (id) VALUES ('11111111-1111-1111-1111-111111111111');
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
      SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":false}}';

      INSERT INTO public.families (id, parent_user_id) VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');
      INSERT INTO public.child_profiles (id, family_id, name) VALUES ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222222', 'Marco');
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("deve rilevare accuratamente quante storie utilizzano un personaggio prima dell'eliminazione", async () => {
    await db.transaction(async (tx) => {
      await tx.exec(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
        SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":false}}';
      `);

      // Creazione di un personaggio
      await tx.exec(`
        INSERT INTO public.characters (id, owner_child_profile_id, family_id, name, traits)
        VALUES ('55555555-5555-5555-5555-555555555551', '33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222222', 'Capitan Leo', 'Coraggioso');
      `);

      // Creazione di 2 storie che lo utilizzano
      await tx.exec(`
        INSERT INTO public.stories (family_id, character_id, target_age_range, generated_text)
        VALUES 
          ('22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555551', '4-6', 'Storia 1'),
          ('22222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555551', '4-6', 'Storia 2');
      `);

      const countQuery = await tx.query(
        "SELECT count(*)::int as cnt FROM public.stories WHERE character_id = '55555555-5555-5555-5555-555555555551';"
      );
      expect(countQuery.rows[0].cnt).toBe(2);
    });
  });

  it("deve mantenere intatta la storia (ON DELETE SET NULL) quando un personaggio utilizzato viene eliminato dopo conferma esplicita", async () => {
    await db.transaction(async (tx) => {
      await tx.exec(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
        SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":false}}';
      `);

      // Eliminiamo il personaggio
      await tx.exec(`
        DELETE FROM public.characters WHERE id = '55555555-5555-5555-5555-555555555551';
      `);

      // Le storie non devono essere state cancellate, ma character_id deve essere diventato NULL
      const res = await tx.query("SELECT id, character_id, generated_text FROM public.stories;");
      expect(res.rows.length).toBeGreaterThanOrEqual(2);
      expect(res.rows[0].character_id).toBeNull();
    });
  });

  it("deve rilevare accuratamente quante storie utilizzano un'ambientazione (Setting) prima dell'eliminazione", async () => {
    await db.transaction(async (tx) => {
      await tx.exec(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
        SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":false}}';
      `);

      // Creazione di un'ambientazione
      await tx.exec(`
        INSERT INTO public.settings (id, owner_child_profile_id, family_id, name, description)
        VALUES ('66666666-6666-6666-6666-666666666661', '33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222222', 'Foresta Magica', 'Alberi parlanti');
      `);

      // Creazione di 3 storie che la utilizzano
      await tx.exec(`
        INSERT INTO public.stories (family_id, setting_id, target_age_range, generated_text)
        VALUES 
          ('22222222-2222-2222-2222-222222222222', '66666666-6666-6666-6666-666666666661', '4-6', 'Storia A'),
          ('22222222-2222-2222-2222-222222222222', '66666666-6666-6666-6666-666666666661', '4-6', 'Storia B'),
          ('22222222-2222-2222-2222-222222222222', '66666666-6666-6666-6666-666666666661', '4-6', 'Storia C');
      `);

      const countQuery = await tx.query(
        "SELECT count(*)::int as cnt FROM public.stories WHERE setting_id = '66666666-6666-6666-6666-666666666661';"
      );
      expect(countQuery.rows[0].cnt).toBe(3);
    });
  });

  it("deve mantenere intatta la storia (ON DELETE SET NULL) quando un'ambientazione utilizzata viene eliminata dopo conferma esplicita", async () => {
    await db.transaction(async (tx) => {
      await tx.exec(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
        SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":false}}';
      `);

      // Eliminiamo l'ambientazione
      await tx.exec(`
        DELETE FROM public.settings WHERE id = '66666666-6666-6666-6666-666666666661';
      `);

      // Le storie non devono essere state cancellate, ma setting_id deve essere diventato NULL
      const res = await tx.query("SELECT id, setting_id, generated_text FROM public.stories WHERE setting_id IS NULL;");
      expect(res.rows.length).toBeGreaterThanOrEqual(3);
    });
  });

  it("deve decidere di visualizzare la modale di conferma esplicita quando il conteggio storie associate è > 0", () => {
    const res = evaluatePreDeleteCheck(3);
    expect(res.requiresExplicitConfirmation).toBe(true);
    expect(res.storyCount).toBe(3);
  });

  it("non deve richiedere la modale di conferma esplicita quando il conteggio storie associate è 0", () => {
    const res = evaluatePreDeleteCheck(0);
    expect(res.requiresExplicitConfirmation).toBe(false);
    expect(res.storyCount).toBe(0);
  });
});
