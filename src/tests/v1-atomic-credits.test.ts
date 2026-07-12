import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

describe("StoriIA v1.0 - Scalaggio Crediti Atomico & Concorrenza (Real PGlite DB Engine Execution)", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Ruoli e schema auth di base
    await db.exec(`
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE service_role NOLOGIN;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY
      );

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

    // 2. Caricamento schema principale MVP e schemi billing v1
    const mvpSchemaPath = path.resolve(process.cwd(), "sql/01_mvp_schema.sql");
    const mvpSql = fs.readFileSync(mvpSchemaPath, "utf-8");
    await db.exec(mvpSql);

    const billingSchemaPath = path.resolve(process.cwd(), "sql/04_v1_phase2_billing_and_credits.sql");
    const billingSql = fs.readFileSync(billingSchemaPath, "utf-8");
    await db.exec(billingSql);

    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20260712120000_v1_bugfixes_schema.sql"
    );
    const migrationSql = fs.readFileSync(migrationPath, "utf-8");
    await db.exec(migrationSql);

    // 3. Inserimento utente genitore e famiglia con 3 crediti
    await db.exec(`
      INSERT INTO auth.users (id) VALUES ('11111111-1111-1111-1111-111111111111');
      INSERT INTO public.families (id, parent_user_id, credits_balance)
      VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 3);
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("deve eseguire realmente consume_credit su database e impedire di andare sotto zero su chiamate multiple", async () => {
    const familyId = "22222222-2222-2222-2222-222222222222";

    // Eseguiamo 5 chiamate reali a public.consume_credit(familyId, description, refId)
    const results: boolean[] = [];

    for (let i = 0; i < 5; i++) {
      const res = await db.query<{ consume_credit: boolean }>(`
        SELECT public.consume_credit('${familyId}', 'Generazione favola #${i + 1}', NULL);
      `);
      results.push(res.rows[0].consume_credit);
    }

    const successCount = results.filter(Boolean).length;
    const failCount = results.filter((r) => !r).length;

    expect(successCount).toBe(3);
    expect(failCount).toBe(2);

    // Verifichiamo direttamente nel database PGlite che il saldo sia esattamente 0
    const famRes = await db.query<{ credits_balance: number }>(`
      SELECT credits_balance FROM public.families WHERE id = '${familyId}';
    `);
    expect(famRes.rows[0].credits_balance).toBe(0);

    // Verifichiamo che nel credit_ledger siano state inserite esattamente 3 transazioni di addebito (-1)
    const ledgerRes = await db.query<{ count: string }>(`
      SELECT count(*)::text as count FROM public.credit_ledger WHERE family_id = '${familyId}' AND amount = -1;
    `);
    expect(Number(ledgerRes.rows[0].count)).toBe(3);
  });

  it("deve eseguire realmente refund_credit su database ripristinando il saldo e inserendo il rimborso in ledger", async () => {
    const familyId = "22222222-2222-2222-2222-222222222222";

    const res = await db.query<{ refund_credit: boolean }>(`
      SELECT public.refund_credit('${familyId}', 'Rimborso per errore di generazione', NULL);
    `);
    expect(res.rows[0].refund_credit).toBe(true);

    // Saldo in DB deve essere salito da 0 a 1
    const famRes = await db.query<{ credits_balance: number }>(`
      SELECT credits_balance FROM public.families WHERE id = '${familyId}';
    `);
    expect(famRes.rows[0].credits_balance).toBe(1);

    // Verifica voce ledger +1
    const ledgerRes = await db.query<{ count: string }>(`
      SELECT count(*)::text as count FROM public.credit_ledger WHERE family_id = '${familyId}' AND amount = 1;
    `);
    expect(Number(ledgerRes.rows[0].count)).toBe(1);
  });
});
