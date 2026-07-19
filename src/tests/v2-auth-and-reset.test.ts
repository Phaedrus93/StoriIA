import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

let currentMockUser: { id: string; email: string } | null = null;
let db: PGlite;

const existingUserId = "e1111111-1111-1111-1111-111111111111";
const socialUserId = "f2222222-2222-2222-2222-222222222222";
const existingFamilyId = "fe111111-1111-1111-1111-111111111111";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => makeMockClient(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => makeMockClient(),
}));

function makeMockClient() {
  return {
    auth: {
      getUser: async () => ({
        data: { user: currentMockUser },
        error: currentMockUser ? null : { message: "Non autenticato" },
      }),
      updateUser: async (attrs: Record<string, any>) => {
        if (!currentMockUser) return { data: null, error: { message: "Non autenticato" } };
        return { data: { user: { ...currentMockUser, ...attrs } }, error: null };
      },
    },
    from: (table: string) => makeQueryBuilder(table),
    rpc: async (fn: string, params: Record<string, any>) => {
      try {
        if (fn === "get_lockout_status") {
          const res = await db.query(
            `SELECT parent_pin_hash as pin_hash, pin_failed_attempts as failed_pin_attempts, pin_locked_until as lockout_until FROM public.family_security WHERE family_id = '${params.p_family_id}'`
          );
          return { data: res.rows, error: null };
        }
        return { data: null, error: { message: `RPC non gestita: ${fn}` } };
      } catch (err: any) {
        return { data: null, error: err };
      }
    },
  };
}

function makeQueryBuilder(table: string) {
  let filters: Record<string, any> = {};
  let colsToSelect: string = "*";

  const chain: any = {
    select: (cols: string = "*") => {
      colsToSelect = cols;
      return chain;
    },
    eq: (col: string, val: any) => {
      filters[col] = val;
      return chain;
    },
    single: async () => {
      try {
        const whereParts = Object.entries(filters).map(([k, v]) => `${k} = '${v}'`);
        const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
        const res = await db.query(`SELECT ${colsToSelect} FROM public.${table} ${whereClause} LIMIT 1`);
        return { data: res.rows[0] || null, error: res.rows[0] ? null : { message: "Not found" } };
      } catch (err: any) {
        return { data: null, error: err };
      }
    },
    upsert: async (records: any, opts?: { onConflict?: string; ignoreDuplicates?: boolean }) => {
      try {
        const arr = Array.isArray(records) ? records : [records];
        for (const rec of arr) {
          const cols = Object.keys(rec);
          const vals = Object.values(rec).map((v) => {
            if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
            if (v === null || v === undefined) return "NULL";
            return v;
          });

          const conflictClause = opts?.onConflict
            ? opts.ignoreDuplicates
              ? `ON CONFLICT (${opts.onConflict}) DO NOTHING`
              : `ON CONFLICT (${opts.onConflict}) DO UPDATE SET ${cols.map((c) => `${c} = EXCLUDED.${c}`).join(", ")}`
            : "";

          await db.query(`
            INSERT INTO public.${table} (${cols.join(", ")})
            VALUES (${vals.join(", ")})
            ${conflictClause}
          `);
        }
        return { data: arr, error: null };
      } catch (err: any) {
        return { data: null, error: err };
      }
    },
    insert: async (records: any) => {
      try {
        const arr = Array.isArray(records) ? records : [records];
        for (const rec of arr) {
          const cols = Object.keys(rec);
          const vals = Object.values(rec).map((v) => {
            if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
            if (v === null || v === undefined) return "NULL";
            return v;
          });
          await db.query(`INSERT INTO public.${table} (${cols.join(", ")}) VALUES (${vals.join(", ")})`);
        }
        return { data: arr, error: null };
      } catch (err: any) {
        return { data: null, error: err };
      }
    },
  };

  return chain;
}

describe("v2-auth-and-reset.test.ts — Reset Password, Verifica Email, Login Social & Account Linking (PGlite)", () => {
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

    // Caricamento migrazione MVP
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/01_mvp_schema.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "sql/04_v1_phase2_billing_and_credits.sql"), "utf-8"));
    await db.exec(fs.readFileSync(path.resolve(process.cwd(), "supabase/migrations/20260712120000_v1_bugfixes_schema.sql"), "utf-8"));

    // Creazione utente email esistente e la sua famiglia (pre-configurata con crediti e abbonamento premium)
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${existingUserId}', 'email.user@example.com');
      INSERT INTO auth.users (id, email) VALUES ('${socialUserId}', 'social.user@example.com');

      INSERT INTO public.families (id, parent_user_id, subscription_tier, credits_balance)
      VALUES ('${existingFamilyId}', '${existingUserId}', 'premium', 50);

      UPDATE public.family_security
      SET parent_pin_hash = 'hashed_pin_1234'
      WHERE family_id = '${existingFamilyId}';
    `);
  });

  afterAll(async () => {
    await db.close();
  });

  it("1. Flusso di aggiornamento password post-reset (supabase.auth.updateUser)", async () => {
    currentMockUser = { id: existingUserId, email: "email.user@example.com" };
    const client = makeMockClient();

    const { data, error } = await client.auth.updateUser({
      password: "NuovaPasswordSicura2026!",
    });

    expect(error).toBeNull();
    expect(data?.user?.email).toBe("email.user@example.com");
  });

  it("2. Auto-creazione idempotente della riga families per un nuovo utente da Login Social (OAuth Callback / Layout check)", async () => {
    currentMockUser = { id: socialUserId, email: "social.user@example.com" };
    const client = makeMockClient();

    // Verifichiamo inizialmente che socialUserId non abbia alcuna famiglia nel DB
    const resBefore = await db.query(`SELECT * FROM public.families WHERE parent_user_id = '${socialUserId}'`);
    expect(resBefore.rows.length).toBe(0);

    // Eseguiamo la logica di garanzia (upsert idempotente usata da /auth/callback e da ParentLayout)
    const { error: upsertErr } = await client
      .from("families")
      .upsert(
        { parent_user_id: socialUserId },
        { onConflict: "parent_user_id", ignoreDuplicates: true }
      );

    expect(upsertErr).toBeNull();

    const resAfter = await db.query(`SELECT * FROM public.families WHERE parent_user_id = '${socialUserId}'`);
    expect(resAfter.rows.length).toBe(1);
    expect((resAfter.rows[0] as any).parent_user_id).toBe(socialUserId);
  });

  it("3. Attivazione obbligatoria del Wizard PIN per il nuovo utente social (pin_hash nullo)", async () => {
    const client = makeMockClient();

    const { data: fam } = await client
      .from("families")
      .select("id")
      .eq("parent_user_id", socialUserId)
      .single();

    expect(fam).not.toBeNull();

    // Chiamata alla procedura get_lockout_status che il ParentLayout utilizza per decidere se mostrare il wizard PIN
    const { data: statusRows, error: rpcErr } = await client.rpc("get_lockout_status", {
      p_family_id: fam.id,
    });

    expect(rpcErr).toBeNull();
    expect(statusRows).not.toBeNull();
    const row = statusRows[0];
    expect(row.pin_hash).toBeNull();
    // Questo pin_hash nullo è esattamente ciò che attiva setShowPinWizard(true) impedendo l'uscita o la modalità bambino
  });

  /*
   * NOTA IMPORTANTE SULL'ACCOUNT LINKING DI SUPABASE AUTH:
   * Questo test verifica solo il comportamento dell'upsert idempotente DATO che Supabase
   * abbia già risolto le due identità (email + Google) sullo stesso user.id.
   * Non verifica che Supabase esegua davvero quel collegamento automatico, poiché PGlite
   * non replica il servizio Auth reale di Supabase.
   * Il vero comportamento di account linking va confermato manualmente in staging/produzione:
   * registra un utente con email X, poi prova "Continua con Google" con la stessa email X,
   * e verifica che nella dashboard Supabase (Authentication > Users) risulti UN SOLO utente
   * con entrambi i provider elencati, non due utenti separati.
   */
  it("4. Verifica Account Linking: tentativo di login Google da parte di un utente con stessa email preesistente non duplica né azzera la famiglia", async () => {
    currentMockUser = { id: existingUserId, email: "email.user@example.com" };
    const client = makeMockClient();

    // Verifichiamo lo stato iniziale della famiglia preesistente
    const resInit = await db.query(`SELECT * FROM public.families WHERE parent_user_id = '${existingUserId}'`);
    expect(resInit.rows.length).toBe(1);
    expect((resInit.rows[0] as any).credits_balance).toBe(50);
    expect((resInit.rows[0] as any).subscription_tier).toBe("premium");

    const secInit = await db.query(`SELECT * FROM public.family_security WHERE family_id = '${existingFamilyId}'`);
    expect((secInit.rows[0] as any).parent_pin_hash).toBe("hashed_pin_1234");

    // Simuliamo l'arrivo dell'utente da Google OAuth (callback/layout) che chiama upsert idempotente
    const { error: upsertErr } = await client
      .from("families")
      .upsert(
        { parent_user_id: existingUserId },
        { onConflict: "parent_user_id", ignoreDuplicates: true }
      );

    expect(upsertErr).toBeNull();

    // Verifichiamo che esista sempre e solo UNA riga, e che crediti, tier e PIN siano rimasti intatti
    const resPost = await db.query(`SELECT * FROM public.families WHERE parent_user_id = '${existingUserId}'`);
    expect(resPost.rows.length).toBe(1);
    const famRow = resPost.rows[0] as any;
    expect(famRow.credits_balance).toBe(50);
    expect(famRow.subscription_tier).toBe("premium");

    const secPost = await db.query(`SELECT * FROM public.family_security WHERE family_id = '${existingFamilyId}'`);
    expect((secPost.rows[0] as any).parent_pin_hash).toBe("hashed_pin_1234");
  });
});
