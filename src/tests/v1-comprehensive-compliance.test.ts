import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

describe("StoriIA v1.0.0 - Test di Conformità e Integrità del Sistema su DB Reale PGlite (PRD v1)", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Setup ruoli e funzioni auth di Supabase nel DB in-memory
    await db.exec(`
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE service_role NOLOGIN;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);

      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
      LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$;

      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB
      LANGUAGE sql STABLE AS $$
        SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
      $$;
    `);

    // 2. Caricamento schema reale completo e migration
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/01_mvp_schema.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/04_v1_phase2_billing_and_credits.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/05_v1_phase3_gamification.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260712000000_v1_unlockable_content.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260712100000_v1_phase4_notifications.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260712120000_v1_bugfixes_schema.sql"), "utf-8"));

    await db.exec(`
      GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;
      GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, anon, service_role;
    `);

    // 3. Popolamento dati reali su DB (2 utenti e 2 famiglie separate)
    await db.exec(`
      INSERT INTO auth.users (id) VALUES 
        ('11111111-1111-1111-1111-111111111111'),
        ('99999999-9999-9999-9999-999999999999');

      INSERT INTO public.families (id, parent_user_id, subscription_tier, credits_balance)
      VALUES 
        ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'free', 10),
        ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'premium', 50);

      INSERT INTO public.credit_ledger (id, family_id, amount, transaction_type, description)
      VALUES 
        ('44444444-4444-4444-4444-444444444401', '22222222-2222-2222-2222-222222222222', -1, 'GENERATION_SPEND', 'Generazione Favola Famiglia A'),
        ('44444444-4444-4444-4444-444444444402', '88888888-8888-8888-8888-888888888888', 30, 'SUBSCRIPTION_RENEWAL', 'Ricarica Mensile Famiglia B');

      INSERT INTO public.notifications (id, family_id, category, title, message)
      VALUES
        ('55555555-5555-5555-5555-555555555501', '22222222-2222-2222-2222-222222222222', 'system', 'Notifica Famiglia A', 'Benvenuta A'),
        ('55555555-5555-5555-5555-555555555502', '88888888-8888-8888-8888-888888888888', 'system', 'Notifica Famiglia B', 'Benvenuta B');

      INSERT INTO public.child_profiles (id, family_id, name)
      VALUES
        ('66666666-6666-6666-6666-666666666601', '22222222-2222-2222-2222-222222222222', 'Bambino Famiglia A'),
        ('66666666-6666-6666-6666-666666666602', '88888888-8888-8888-8888-888888888888', 'Bambino Famiglia B');

      INSERT INTO public.stories (id, family_id, target_age_range, generated_text)
      VALUES
        ('77777777-7777-7777-7777-777777777701', '22222222-2222-2222-2222-222222222222', '4-6', 'Testo A'),
        ('77777777-7777-7777-7777-777777777702', '88888888-8888-8888-8888-888888888888', '4-6', 'Testo B');

      INSERT INTO public.story_assignments (story_id, child_profile_id)
      VALUES
        ('77777777-7777-7777-7777-777777777701', '66666666-6666-6666-6666-666666666601'),
        ('77777777-7777-7777-7777-777777777702', '66666666-6666-6666-6666-666666666602');
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  describe("1. Isolamento Row Level Security (RLS) su credit_ledger tra Famiglie Diverse", () => {
    it("deve impedire al genitore A (autenticato come ruolo Postgres authenticated) di leggere le transazioni credit_ledger della famiglia B", async () => {
      const parentAUid = "11111111-1111-1111-1111-111111111111";

      await db.exec(`
        SET ROLE authenticated;
        SET request.jwt.claim.sub = '${parentAUid}';
      `);

      // Interrogazione diretta sul DB reale con ruolo authenticated
      const res = await db.query<{ id: string; description: string; family_id: string }>(`
        SELECT id, description, family_id FROM public.credit_ledger;
      `);

      // Verifica su motore Postgres reale
      expect(res.rows.length).toBe(1);
      expect(res.rows[0].id).toBe("44444444-4444-4444-4444-444444444401");
      expect(res.rows[0].description).toBe("Generazione Favola Famiglia A");
      expect(res.rows.some((row) => row.family_id === "88888888-8888-8888-8888-888888888888")).toBe(false);

      await db.exec(`RESET ROLE;`);
    });

    it("deve consentire al genitore B di leggere solo ed esclusivamente le proprie transazioni credit_ledger", async () => {
      const parentBUid = "99999999-9999-9999-9999-999999999999";

      await db.exec(`
        SET ROLE authenticated;
        SET request.jwt.claim.sub = '${parentBUid}';
      `);

      const res = await db.query<{ id: string; description: string }>(`
        SELECT id, description FROM public.credit_ledger;
      `);

      expect(res.rows.length).toBe(1);
      expect(res.rows[0].id).toBe("44444444-4444-4444-4444-444444444402");
      expect(res.rows[0].description).toBe("Ricarica Mensile Famiglia B");

      await db.exec(`RESET ROLE;`);
    });

    it("deve impedire a una famiglia di accedere alle notifiche e alle assegnazioni storie di un'altra famiglia tramite RLS su PGlite", async () => {
      const parentAUid = "11111111-1111-1111-1111-111111111111";

      await db.exec(`
        SET ROLE authenticated;
        SET request.jwt.claim.sub = '${parentAUid}';
      `);

      // 1. Verifica isolamento RLS reale sulla tabella notifications
      const notifRes = await db.query<{ id: string; title: string; family_id: string }>(`
        SELECT id, title, family_id FROM public.notifications;
      `);
      expect(notifRes.rows.length).toBeGreaterThanOrEqual(1);
      expect(notifRes.rows.some((row) => row.id === "55555555-5555-5555-5555-555555555501")).toBe(true);
      expect(notifRes.rows.some((row) => row.id === "55555555-5555-5555-5555-555555555502")).toBe(false);

      // 2. Verifica isolamento RLS reale sulla tabella story_assignments
      const assignRes = await db.query<{ story_id: string; child_profile_id: string }>(`
        SELECT story_id, child_profile_id FROM public.story_assignments;
      `);
      expect(assignRes.rows.length).toBe(1);
      expect(assignRes.rows[0].story_id).toBe("77777777-7777-7777-7777-777777777701");
      expect(assignRes.rows.some((row) => row.story_id === "77777777-7777-7777-7777-777777777702")).toBe(false);

      await db.exec(`RESET ROLE;`);
    });
  });

  describe("2. Transazionalità e Rimborso Reale su DB (Nessuno scalo in caso di fallimento o blocco)", () => {
    it("deve eseguire consume_credit e refund_credit in modo atomico sul DB reale PGlite", async () => {
      const familyAId = "22222222-2222-2222-2222-222222222222";

      // Legge saldo iniziale
      const initRes = await db.query<{ credits_balance: number }>(`
        SELECT credits_balance FROM public.families WHERE id = '${familyAId}'
      `);
      const initialBalance = initRes.rows[0].credits_balance;

      // Consuma credito (es. generazione iniziata)
      await db.query(`SELECT public.consume_credit('${familyAId}', 'Inizio Generazione AI', NULL)`);
      const afterConsume = await db.query<{ credits_balance: number }>(`
        SELECT credits_balance FROM public.families WHERE id = '${familyAId}'
      `);
      expect(afterConsume.rows[0].credits_balance).toBe(initialBalance - 1);

      // Rimborso per fallimento moderazione o errore di rete
      await db.query(`SELECT public.refund_credit('${familyAId}', 'Rimborso per blocco di sicurezza', NULL)`);
      const afterRefund = await db.query<{ credits_balance: number }>(`
        SELECT credits_balance FROM public.families WHERE id = '${familyAId}'
      `);
      expect(afterRefund.rows[0].credits_balance).toBe(initialBalance);
    });
  });
});
