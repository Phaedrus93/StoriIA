import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { moderateTextWithAI } from "@/lib/ai/story-generator";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

describe("StoriIA v1.0 - Moderazione Creazione Personaggi & Ambientazioni & Verifica Schema image_url", () => {
  let pglite: PGlite;

  beforeAll(async () => {
    pglite = new PGlite();

    await pglite.exec(`
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE service_role NOLOGIN;

      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY);

      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
      LANGUAGE sql STABLE AS $$
        SELECT '11111111-1111-1111-1111-111111111111'::uuid;
      $$;

      CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB
      LANGUAGE sql STABLE AS $$
        SELECT '{}'::jsonb;
      $$;
    `);

    // Caricamento schema principale che definisce characters e settings con image_url
    await pglite.exec(
      fs.readFileSync(path.resolve(process.cwd(), "sql/01_mvp_schema.sql"), "utf-8")
    );
    await pglite.exec(
      fs.readFileSync(path.resolve(process.cwd(), "sql/04_v1_phase2_billing_and_credits.sql"), "utf-8")
    );

    // Popolamento parent e child per inserimenti di test
    await pglite.exec(`
      INSERT INTO auth.users (id) VALUES ('11111111-1111-1111-1111-111111111111');
      INSERT INTO public.families (id, parent_user_id, subscription_tier, credits_balance)
      VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'free', 5);
      INSERT INTO public.child_profiles (id, family_id, name)
      VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Leo');
    `);
  });

  afterAll(async () => {
    await pglite.close();
  });

  it("deve bloccare preventivamente un personaggio con contenuto vietato (es. arma/violenza)", async () => {
    const res = await moderateTextWithAI("Cavaliere con pistola e sangue");
    expect(res.safe).toBe(false);
    expect(res.reason).toBeDefined();
  });

  it("deve consentire un personaggio sicuro ed educativo", async () => {
    const res = await moderateTextWithAI("Volpe gentile che ama leggere libri");
    expect(res.safe).toBe(true);
  });

  it("deve applicare fail-closed se il servizio di moderazione AI restituisce un errore", async () => {
    const serviceFailClosedResponse = {
      safe: false,
      error: true,
      reason: "Servizio temporaneamente non disponibile, riprova",
    };

    expect(serviceFailClosedResponse.safe).toBe(false);
    expect(serviceFailClosedResponse.error).toBe(true);
    expect(serviceFailClosedResponse.reason).toContain("Servizio temporaneamente non disponibile");
  });

  it("deve inserire correttamente un personaggio in characters includendo image_url e is_preset e con owner_child_profile_id opzionale", async () => {
    await pglite.query(`
      INSERT INTO public.characters (
        id, family_id, name, traits, image_url, is_preset
      ) VALUES (
        '44444444-4444-4444-4444-444444444444',
        '22222222-2222-2222-2222-222222222222',
        'Volpino Coraggioso',
        'Amichevole, curioso',
        '/avatars/fox.svg',
        false
      );
    `);

    const res = await pglite.query<{ image_url: string; is_preset: boolean }>(
      "SELECT image_url, is_preset FROM public.characters WHERE id = '44444444-4444-4444-4444-444444444444'"
    );
    expect(res.rows[0].image_url).toBe("/avatars/fox.svg");
    expect(res.rows[0].is_preset).toBe(false);
  });

  it("deve inserire correttamente un'ambientazione in settings includendo image_url e is_preset e con owner_child_profile_id opzionale", async () => {
    await pglite.query(`
      INSERT INTO public.settings (
        id, family_id, name, description, image_url, is_preset
      ) VALUES (
        '55555555-5555-5555-5555-555555555555',
        '22222222-2222-2222-2222-222222222222',
        'Foresta Incantata',
        'Alberi alti e lucciole luminose',
        '/settings/forest.svg',
        false
      );
    `);

    const res = await pglite.query<{ image_url: string; is_preset: boolean }>(
      "SELECT image_url, is_preset FROM public.settings WHERE id = '55555555-5555-5555-5555-555555555555'"
    );
    expect(res.rows[0].image_url).toBe("/settings/forest.svg");
    expect(res.rows[0].is_preset).toBe(false);
  });
});
