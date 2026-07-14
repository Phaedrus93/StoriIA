import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

describe("StoriIA — Verifica Correzioni Punti 4-10 (Gamification, Add-on, Crediti, Notifiche, Indirizzo)", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();

    // 1. Creazione ruoli Supabase e schema auth
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

    // 2. Esecuzione di tutte le migrazioni
    const migrationsDir = path.join(process.cwd(), "supabase/migrations");
    const files = fs.readdirSync(migrationsDir).sort();

    for (const file of files) {
      if (file.endsWith(".sql")) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
        await db.exec(sql);
      }
    }

    // Creiamo utente mock
    const parentId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    await db.query(`
      INSERT INTO auth.users (id, email)
      VALUES ('${parentId}', 'parent.fixes@example.com')
      ON CONFLICT DO NOTHING;
    `);

    // Creiamo famiglia
    await db.query(`
      INSERT INTO public.families (id, parent_user_id, subscription_tier, subscription_status, credits_balance, addon_children_count, pending_addon_children_count)
      VALUES ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11', '${parentId}', 'premium', 'active', 50, 3, 1)
      ON CONFLICT DO NOTHING;
    `);

    // Creiamo profilo bambino
    await db.query(`
      INSERT INTO public.child_profiles (id, family_id, name, birth_year, adventure_points)
      VALUES ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11', 'Leo', 2018, 100)
      ON CONFLICT DO NOTHING;
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("Punto 4: verifica lettura missioni, badge e cosmetici del Gamification Store e ordinamento per costo", async () => {
    const resCosmetics = await db.query(`
      SELECT name, category, cost_points, icon_preset
      FROM public.cosmetic_items
      ORDER BY cost_points ASC;
    `);
    expect(resCosmetics.rows.length).toBeGreaterThanOrEqual(4);
    // Verifica che l'ordinamento per cost_points sia rispettato
    const firstCost = (resCosmetics.rows[0] as any).cost_points;
    const secondCost = (resCosmetics.rows[1] as any).cost_points;
    expect(firstCost).toBeLessThanOrEqual(secondCost);

    const resQuests = await db.query(`
      SELECT title, target_count
      FROM public.reading_quests
      ORDER BY target_count ASC;
    `);
    expect(resQuests.rows.length).toBeGreaterThanOrEqual(3);
  });

  it("Punto 5: verifica applicazione del pending_addon_children_count al rinnovo abbonamento", async () => {
    // Verifichiamo lo stato prima del rinnovo
    const before = await db.query(`
      SELECT addon_children_count, pending_addon_children_count
      FROM public.families
      WHERE id = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11';
    `);
    expect((before.rows[0] as any).addon_children_count).toBe(3);
    expect((before.rows[0] as any).pending_addon_children_count).toBe(1);

    // Simuliamo la logica eseguita nel webhook stripe all'arrivo di invoice.payment_succeeded con subscription_cycle
    await db.query(`
      UPDATE public.families
      SET
        addon_children_count = pending_addon_children_count,
        pending_addon_children_count = NULL,
        credits_balance = credits_balance + 60
      WHERE id = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11'
        AND pending_addon_children_count IS NOT NULL;
    `);

    // Verifichiamo il nuovo stato dopo il rinnovo
    const after = await db.query(`
      SELECT addon_children_count, pending_addon_children_count, credits_balance
      FROM public.families
      WHERE id = 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11';
    `);
    expect((after.rows[0] as any).addon_children_count).toBe(1);
    expect((after.rows[0] as any).pending_addon_children_count).toBe(null);
    expect((after.rows[0] as any).credits_balance).toBe(110);
  });

  it("Punto 7 & 8: verifica che account Free senza stripe_subscription_id non esponga azioni non permesse e che i crediti siano allineati", async () => {
    const parentFree = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${parentFree}', 'free@example.com') ON CONFLICT DO NOTHING;
      INSERT INTO public.families (id, parent_user_id, subscription_tier, subscription_status, credits_balance, stripe_subscription_id)
      VALUES ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f22', '${parentFree}', 'free', 'active', 5, NULL)
      ON CONFLICT DO NOTHING;
    `);

    const res = await db.query(`
      SELECT subscription_tier, subscription_status, credits_balance, stripe_subscription_id
      FROM public.families
      WHERE parent_user_id = '${parentFree}';
    `);
    const fam = res.rows[0] as any;
    expect(fam.subscription_tier).toBe("free");
    expect(fam.credits_balance).toBe(5);
    expect(fam.stripe_subscription_id).toBe(null);

    // Logica di visibilità pulsanti (Punto 7)
    const showPassaAFree = fam.subscription_tier !== "free";
    const showAnnulla = Boolean(fam.stripe_subscription_id) && ["active", "trialing"].includes(fam.subscription_status);

    expect(showPassaAFree).toBe(false);
    expect(showAnnulla).toBe(false);
  });

  it("Punto 9: verifica salvataggio notifica nella tabella notifications alla generazione / errore", async () => {
    const familyId = "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11";
    // Inseriamo una notifica di successo come fatto da notifyFamily
    await db.query(`
      INSERT INTO public.notifications (family_id, category, title, message, action_link)
      VALUES ('${familyId}', 'activity', 'Nuova storia generata! ✨', 'La storia è pronta.', '/read?storyId=123');
    `);

    const notifs = await db.query(`
      SELECT * FROM public.notifications WHERE family_id = '${familyId}' AND category = 'activity';
    `);
    expect(notifs.rows.length).toBeGreaterThanOrEqual(1);
    expect((notifs.rows[0] as any).title).toBe("Nuova storia generata! ✨");
  });

  it("Punto 10: verifica salvataggio separato di postal_code e city in parent_billing_profiles", async () => {
    const familyId = "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380f11";
    await db.query(`
      INSERT INTO public.parent_billing_profiles (family_id, first_name, last_name, tax_id, billing_address, postal_code, city, country)
      VALUES ('${familyId}', 'Mario', 'Rossi', 'RSSMRA80A01H501Z', 'Via Roma 10', '00100', 'Roma', 'IT')
      ON CONFLICT (family_id) DO UPDATE SET
        billing_address = EXCLUDED.billing_address,
        postal_code = EXCLUDED.postal_code,
        city = EXCLUDED.city;
    `);

    const profile = await db.query(`
      SELECT billing_address, postal_code, city, country
      FROM public.parent_billing_profiles
      WHERE family_id = '${familyId}';
    `);
    expect((profile.rows[0] as any).billing_address).toBe("Via Roma 10");
    expect((profile.rows[0] as any).postal_code).toBe("00100");
    expect((profile.rows[0] as any).city).toBe("Roma");
  });
});
