import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { hashParentPin, verifyParentPin } from "../lib/security/pin";

describe("Phase 5 — Child Mode & PIN Lockout Anti Brute-Force Verification", () => {
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

    await db.exec(`
      INSERT INTO auth.users (id) VALUES ('11111111-1111-1111-1111-111111111111');
      SET LOCAL ROLE authenticated;
      SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
      SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":false}}';

      INSERT INTO public.families (id, parent_user_id) VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');
    `);
  }, 30000);

  afterAll(async () => {
    await db.close();
  });

  it("deve salvare l'hash PIN sicuro in family_security tramite set_parent_pin_hash", async () => {
    const pin = "4567";
    const hashed = await hashParentPin(pin);

    await db.transaction(async (tx) => {
      await tx.exec(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
        SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":false}}';
      `);

      await tx.query(
        "SELECT public.set_parent_pin_hash('22222222-2222-2222-2222-222222222222', $1);",
        [hashed]
      );

      const res = await tx.query(
        "SELECT pin_hash FROM public.get_lockout_status('22222222-2222-2222-2222-222222222222');"
      );
      expect(res.rows[0].pin_hash).toBe(hashed);
    });
  });

  it("deve incrementare i tentativi falliti in record_pin_attempt e bloccare dopo 5 fallimenti consecutivi", async () => {
    await db.transaction(async (tx) => {
      await tx.exec(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
        SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":true}}';
      `);

      // 4 fallimenti consecutivi -> non ancora in blocco
      for (let i = 0; i < 4; i++) {
        await tx.query(
          "SELECT public.record_pin_attempt('22222222-2222-2222-2222-222222222222', false);"
        );
      }

      let status = await tx.query(
        "SELECT is_locked, failed_attempts FROM public.get_lockout_status('22222222-2222-2222-2222-222222222222');"
      );
      expect(status.rows[0].failed_attempts).toBe(4);
      expect(status.rows[0].is_locked).toBe(false);

      // 5° fallimento -> attiva Lockout (15 minuti)
      await tx.query(
        "SELECT public.record_pin_attempt('22222222-2222-2222-2222-222222222222', false);"
      );

      status = await tx.query(
        "SELECT is_locked, failed_attempts, locked_until FROM public.get_lockout_status('22222222-2222-2222-2222-222222222222');"
      );
      expect(status.rows[0].failed_attempts).toBe(5);
      expect(status.rows[0].is_locked).toBe(true);
      expect(status.rows[0].locked_until).toBeDefined();
    });
  });

  it("deve resettare a 0 i tentativi falliti quando viene registrato un successo di sblocco", async () => {
    await db.transaction(async (tx) => {
      await tx.exec(`
        SET LOCAL ROLE authenticated;
        SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
        SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","app_metadata":{"is_child_mode":false}}';
      `);

      await tx.query(
        "SELECT public.record_pin_attempt('22222222-2222-2222-2222-222222222222', true);"
      );

      const status = await tx.query(
        "SELECT is_locked, failed_attempts FROM public.get_lockout_status('22222222-2222-2222-2222-222222222222');"
      );
      expect(status.rows[0].failed_attempts).toBe(0);
      expect(status.rows[0].is_locked).toBe(false);
    });
  });
});
