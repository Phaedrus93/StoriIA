import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

describe("Test Isolamento Famiglia — Selezione Profilo Bambino (/api/child-mode/select-profile)", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

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

    // Famiglia 1 e Famiglia 2
    await db.exec(`
      INSERT INTO auth.users (id) VALUES
        ('11111111-1111-1111-1111-111111111111'),
        ('22222222-2222-2222-2222-222222222222');

      INSERT INTO public.families (id, parent_user_id) VALUES
        ('aaaa1111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111'),
        ('bbbb2222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222');

      INSERT INTO public.child_profiles (id, family_id, name) VALUES
        ('cccc1111-1111-1111-1111-111111111111', 'aaaa1111-1111-1111-1111-111111111111', 'Bambino Famiglia 1'),
        ('dddd2222-2222-2222-2222-222222222222', 'bbbb2222-2222-2222-2222-222222222222', 'Bambino Famiglia 2');
    `);
  }, 30000);

  afterAll(async () => {
    await db.close();
  });

  it("deve rifiutare la selezione di un childProfileId appartenente a una famiglia diversa dall'utente autenticato", async () => {
    await db.transaction(async (tx) => {
      // Impostiamo l'utente corrente come Utente 1 (famiglia aaaa1111...)
      await tx.exec(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
        SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":false}}';
      `);

      // Tentativo di selezionare il profilo 'dddd2222...' della Famiglia 2
      const res = await tx.query(`
        SELECT id, name FROM public.child_profiles
        WHERE id = 'dddd2222-2222-2222-2222-222222222222'
          AND family_id = public.get_my_family_id();
      `);

      // La query non deve restituire alcun record, impedendo al server di impostare il claim JWT per quel profilo
      expect(res.rows.length).toBe(0);
    });
  });

  it("deve consentire la selezione di un childProfileId appartenente alla propria famiglia", async () => {
    await db.transaction(async (tx) => {
      await tx.exec(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
        SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":false}}';
      `);

      const res = await tx.query(`
        SELECT id, name FROM public.child_profiles
        WHERE id = 'cccc1111-1111-1111-1111-111111111111'
          AND family_id = public.get_my_family_id();
      `);

      expect(res.rows.length).toBe(1);
      expect(res.rows[0].name).toBe("Bambino Famiglia 1");
    });
  });
});
