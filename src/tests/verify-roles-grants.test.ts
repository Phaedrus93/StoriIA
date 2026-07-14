import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

describe("StoriIA v1.5 — Verifica Privilegi GRANT per Ruoli Supabase (authenticated vs anon)", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Creazione ruoli Supabase di base e schema auth
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

    // 2. Caricamento schema iniziale e migrazioni di creazione tabelle
    const initSchema = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260711000000_init_schema.sql"), "utf-8");
    const billingSchema = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260711110000_v1_phase2_billing_and_credits.sql"), "utf-8");
    const gamificationSchema = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260711120000_v1_phase3_gamification.sql"), "utf-8");
    const unlockableSchema = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260712000000_v1_unlockable_content.sql"), "utf-8");
    const notificationsSchema = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260712100000_v1_phase4_notifications.sql"), "utf-8");
    const stripeWebhookSchema = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260713120000_v1_stripe_webhook_idempotency.sql"), "utf-8");
    
    await db.exec(initSchema);
    await db.exec(billingSchema);
    await db.exec(gamificationSchema);
    await db.exec(unlockableSchema);
    await db.exec(notificationsSchema);
    await db.exec(stripeWebhookSchema);

    // 3. Carichiamo ed eseguiamo la nostra migrazione di fix GRANT appena corretta
    const fixGrantsSchema = fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260714130000_v1_fix_roles_grants.sql"), "utf-8");
    await db.exec(fixGrantsSchema);

    // 4. Inseriamo un utente in auth.users per poter assumere la sua identità
    await db.exec(`
      INSERT INTO auth.users (id) VALUES ('11111111-1111-1111-1111-111111111111') ON CONFLICT DO NOTHING;
    `);
  });

  it("deve permettere al ruolo authenticated di interrogare notifications, notification_preferences e parent_billing_profiles senza errore permission denied", async () => {
    await db.exec(`
      SET ROLE authenticated;
      SET request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
    `);

    // Eseguiamo SELECT su tutte e 3 le tabelle come ruolo authenticated
    const resNotifications = await db.query("SELECT * FROM public.notifications;");
    const resPrefs = await db.query("SELECT * FROM public.notification_preferences;");
    const resBilling = await db.query("SELECT * FROM public.parent_billing_profiles;");

    // Le query devono avere successo (anche restituendo 0 righe se vuote dal filtro RLS o tabella vuota)
    expect(resNotifications.rows).toBeDefined();
    expect(resPrefs.rows).toBeDefined();
    expect(resBilling.rows).toBeDefined();

    await db.exec("RESET ROLE;");
  });

  it("deve RESPINGERE una query del ruolo anon su parent_billing_profiles con permission denied", async () => {
    await db.exec(`
      SET ROLE anon;
    `);

    // Verifichiamo che la query fallisca con errore di permesso
    await expect(db.query("SELECT * FROM public.parent_billing_profiles;"))
      .rejects.toThrow(/permission denied for table parent_billing_profiles/i);

    await db.exec("RESET ROLE;");
  });

  it("deve permettere al ruolo anon di interrogare le tabelle specificamente concesse (avatar_presets, moral_lessons)", async () => {
    await db.exec(`
      SET ROLE anon;
    `);

    const resAvatars = await db.query("SELECT * FROM public.avatar_presets;");
    const resMorals = await db.query("SELECT * FROM public.moral_lessons;");

    expect(resAvatars.rows).toBeDefined();
    expect(resMorals.rows).toBeDefined();

    await db.exec("RESET ROLE;");
  });
});
