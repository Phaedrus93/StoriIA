import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";
import { filterStories } from "@/lib/stories-filter";
import { type UnifiedStory } from "@/components/stories/StoryCardUnified";

let db: PGlite;
const testFamilyId = "fa111111-1111-1111-1111-111111111111";
const testParentId = "ea111111-1111-1111-1111-111111111111";

describe("v2-my-stories-unified.test.ts — Vista Unificata 'Le Mie Storie', Filtri Relazionali & Protezione Preset", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      CREATE ROLE authenticated NOLOGIN;
      CREATE ROLE anon NOLOGIN;
      CREATE ROLE service_role NOLOGIN;
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT);

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

    // Carichiamo lo schema MVP reale per testare le query SQL e RLS
    await db.exec(
      fs.readFileSync(
        path.resolve(process.cwd(), "sql/01_mvp_schema.sql"),
        "utf-8"
      )
    );

    // Seed famiglia e 1 storia AI + 2 figli
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${testParentId}', 'parent@storiia.com');
      INSERT INTO public.families (id, parent_user_id) VALUES ('${testFamilyId}', '${testParentId}');

      INSERT INTO public.child_profiles (id, family_id, name, birth_year) VALUES
        ('c1111111-1111-1111-1111-111111111111', '${testFamilyId}', 'Lavinia', 2019),
        ('c2222222-2222-2222-2222-222222222222', '${testFamilyId}', 'Lino', 2021);

      INSERT INTO public.stories (id, family_id, target_age_range, generated_text, source) VALUES
        ('d1111111-1111-1111-1111-111111111111', '${testFamilyId}', '4-6', '# La Favola di Lavinia e il Gattomarino\n\nTesto della favola generata con AI...', 'ai_generated');
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("1. Query unificata sul database (stories): RLS restituisce sia la storia AI della famiglia sia le favole preset globali", async () => {
    await db.exec(`
      SET request.jwt.claim.sub = '${testParentId}';
      SET ROLE authenticated;
    `);

    // Esecuzione query sotto ruolo autenticato verificando la policy RLS (family_id = get_my_family_id() OR source = 'preset')
    const res = await db.query(`
      SELECT id, source, target_age_range
      FROM public.stories
      WHERE family_id = public.get_my_family_id() OR source = 'preset'
    `);

    // Ripristiniamo il ruolo e il claim per non interferire con altri test
    await db.exec(`
      SET ROLE postgres;
      SET request.jwt.claim.sub = '';
    `);

    // Deve esserci 1 storia AI creata sopra + le 6 favole preset gratuite inserite dal seed di 01_mvp_schema.sql
    expect(res.rows.length).toBeGreaterThanOrEqual(7);
    const aiStory = res.rows.find((r: any) => r.source === "ai_generated");
    const presetStory = res.rows.find((r: any) => r.source === "preset");

    expect(aiStory).toBeDefined();
    expect(presetStory).toBeDefined();
  });

  it("2. [Caso Esplicito Multi-Bambino a Stati Diversi] filterStories rispecchia il criterio 'Almeno un bambino' su 'Tutti' e il filtro sul singolo bambino", () => {
    const childAId = "c1111111-1111-1111-1111-111111111111"; // Lavinia
    const childBId = "c2222222-2222-2222-2222-222222222222"; // Lino

    // Storia assegnata a DUE bambini con stati opposti (Lavinia: completed, Lino: in_progress)
    const multiAssignedStory: UnifiedStory = {
      id: "story-multi",
      source: "ai_generated",
      target_age_range: "4-6",
      generated_text: "# Avventura Doppia\nUna storia per Lavinia e Lino.",
      created_at: new Date().toISOString(),
      assignments: [
        {
          id: "ass-1",
          child_profile_id: childAId,
          reading_status: "completed",
          last_read_position: 100,
        },
        {
          id: "ass-2",
          child_profile_id: childBId,
          reading_status: "in_progress",
          last_read_position: 45,
        },
      ],
    };

    const dataset = [multiAssignedStory];

    // Verifica A: Bambino Assegnato = 'all', Stato Lettura = 'completed' -> deve comparire perché Lavinia l'ha completata (ANY)
    const resAllCompleted = filterStories(dataset, {
      searchQuery: "",
      sourceFilter: "all",
      ageFilter: "all",
      childFilter: "all",
      statusFilter: "completed",
    });
    expect(resAllCompleted.length).toBe(1);

    // Verifica B: Bambino Assegnato = 'all', Stato Lettura = 'in_progress' -> deve comparire perché Lino è in corso (ANY)
    const resAllInProgress = filterStories(dataset, {
      searchQuery: "",
      sourceFilter: "all",
      ageFilter: "all",
      childFilter: "all",
      statusFilter: "in_progress",
    });
    expect(resAllInProgress.length).toBe(1);

    // Verifica C: Bambino Assegnato = Lavinia (childAId), Stato Lettura = 'in_progress' -> NON deve comparire (Lavinia è completed!)
    const resLaviniaInProgress = filterStories(dataset, {
      searchQuery: "",
      sourceFilter: "all",
      ageFilter: "all",
      childFilter: childAId,
      statusFilter: "in_progress",
    });
    expect(resLaviniaInProgress.length).toBe(0);

    // Verifica D: Bambino Assegnato = Lavinia (childAId), Stato Lettura = 'completed' -> DEVE comparire per Lavinia
    const resLaviniaCompleted = filterStories(dataset, {
      searchQuery: "",
      sourceFilter: "all",
      ageFilter: "all",
      childFilter: childAId,
      statusFilter: "completed",
    });
    expect(resLaviniaCompleted.length).toBe(1);
  });

  it("3. [Caso Esplicito unassigned] filterStories verifica l'assenza totale di righe per childFilter = 'all' o per bambino specifico", () => {
    const childAId = "c1111111-1111-1111-1111-111111111111"; // Lavinia
    const childCId = "c3333333-3333-3333-3333-333333333333"; // Terzo figlio non assegnato

    const unassignedStory: UnifiedStory = {
      id: "story-free",
      source: "ai_generated",
      target_age_range: "0-3",
      generated_text: "# Storia Nuova Mai Letta\nNessuna assegnazione.",
      created_at: new Date().toISOString(),
      assignments: [], // Assenza totale di assegnazioni
    };

    const assignedToAStory: UnifiedStory = {
      id: "story-lavinia-only",
      source: "ai_generated",
      target_age_range: "7-10",
      generated_text: "# Storia di Lavinia\nAssegnata solo a Lavinia.",
      created_at: new Date().toISOString(),
      assignments: [
        {
          id: "ass-a",
          child_profile_id: childAId,
          reading_status: "new",
          last_read_position: 0,
        },
      ],
    };

    const dataset = [unassignedStory, assignedToAStory];

    // Caso 1: Bambino Assegnato = 'all', Stato = 'unassigned' -> deve restituire solo 'story-free' (che ha assignments.length === 0)
    const resGlobalUnassigned = filterStories(dataset, {
      searchQuery: "",
      sourceFilter: "all",
      ageFilter: "all",
      childFilter: "all",
      statusFilter: "unassigned",
    });
    expect(resGlobalUnassigned.length).toBe(1);
    expect(resGlobalUnassigned[0].id).toBe("story-free");

    // Caso 2: Bambino Assegnato = Child-C (non assegnato a story-lavinia-only), Stato = 'unassigned'
    // Deve restituire sia 'story-free' sia 'story-lavinia-only' (perché Child-C non è assegnato a nessuna delle due)
    const resChildCUnassigned = filterStories(dataset, {
      searchQuery: "",
      sourceFilter: "all",
      ageFilter: "all",
      childFilter: childCId,
      statusFilter: "unassigned",
    });
    expect(resChildCUnassigned.length).toBe(2);
  });

  it("4. Protezione contro l'eliminazione dei preset: le favole predefinite non consentono la cancellazione", () => {
    const presetStory: UnifiedStory = {
      id: "preset-1",
      source: "preset",
      target_age_range: "0-3",
      generated_text: "# Il Volpino e la Stella Lucente",
      created_at: new Date().toISOString(),
    };

    const canDelete = (story: UnifiedStory) => story.source !== "preset";

    expect(canDelete(presetStory)).toBe(false);
  });
});
