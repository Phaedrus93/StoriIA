import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const artifactDir = "C:/Users/User/.gemini/antigravity/brain/b8b22a75-7377-433f-80f9-c05be331d422/qa-screenshots";
const projectDir = path.resolve(__dirname, "../qa-screenshots");

fs.mkdirSync(artifactDir, { recursive: true });
fs.mkdirSync(projectDir, { recursive: true });

async function run() {
  console.log("Avvio server locale Next.js su porta 3006 per verifica navigazione, libreria bambino e input...");
  const serverProcess = spawn("npx", ["next", "start", "-p", "3006"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    shell: true,
  });

  await new Promise((r) => setTimeout(r, 4000));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
  });
  const page = await context.newPage();

  async function takeShot(name, fullPage = true) {
    await page.waitForTimeout(1000);
    const shotArtifact = path.join(artifactDir, `${name}.png`);
    const shotProject = path.join(projectDir, `${name}.png`);
    await page.screenshot({ path: shotArtifact, fullPage });
    fs.copyFileSync(shotArtifact, shotProject);
    console.log(`[OK] Screenshot salvato: ${name}.png`);
  }

  try {
    // PUNTO 3: Campi EMAIL/PASSWORD Login e Registrazione (spaziatura icone/placeholder)
    console.log("1. Verifica spaziatura icone/placeholder in /login...");
    await page.goto("http://localhost:3006/login", { waitUntil: "networkidle" });
    await takeShot("req_03_login_inputs_spacing");

    console.log("2. Verifica spaziatura icone/placeholder in /register...");
    await page.goto("http://localhost:3006/register", { waitUntil: "networkidle" });
    await takeShot("req_03_register_inputs_spacing");

    // Registrazione utente QA per testare Punti 1 e 2
    console.log("3. Registrazione utente QA...");
    const qaEmail = `qa.audit.pt2.${Date.now()}@storiia-qa.test`;
    await page.fill("input[type='email']", qaEmail);
    await page.fill("input[type='password']", "TestPassword2026!");
    await page.click("button[type='submit']");
    await page.waitForTimeout(2500);

    // Wizard PIN se presente
    try {
      await page.waitForSelector("input[placeholder='••••']", { timeout: 4000 });
      const pinInputs = page.locator("input[placeholder='••••']");
      await pinInputs.nth(0).fill("1234");
      await pinInputs.nth(1).fill("1234");
      await page.click("button[type='submit']");
      await page.waitForTimeout(1500);
    } catch (e) {}

    // PUNTO 1: Screenshot di 3 pagine genitore con il link "← Torna alla Dashboard Genitore"
    console.log("4. Verifica link coerente 'Torna alla Dashboard Genitore' in /library/characters...");
    await page.goto("http://localhost:3006/library/characters", { waitUntil: "networkidle" });
    await takeShot("req_01_library_characters_back_link");

    console.log("5. Verifica link coerente 'Torna alla Dashboard Genitore' in /children...");
    await page.goto("http://localhost:3006/children", { waitUntil: "networkidle" });
    await takeShot("req_01_children_back_link");

    console.log("6. Verifica link coerente 'Torna alla Dashboard Genitore' in /profile...");
    await page.goto("http://localhost:3006/profile", { waitUntil: "networkidle" });
    await takeShot("req_01_profile_back_link");

    // Creazione del bambino e di 3 storie per PUNTO 2 (Libreria Bambino ordinata in 3 sezioni)
    console.log("7. Creazione profilo bambino Anna Lettura...");
    await page.goto("http://localhost:3006/children", { waitUntil: "networkidle" });
    await page.fill("input[placeholder='es. Sofia']", "Anna Lettura");
    await page.fill("input[placeholder='es. 2019']", "2018");
    await page.click("button:has-text('Crea Profilo Figlio')");
    await page.waitForTimeout(2500);

    // Popoliamo 3 storie con stati diversi usando l'API o Supabase
    // Creiamo storie direttamente dall'archivio o tramite client admin per test veloci e deterministici
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      const sb = createClient(supabaseUrl, supabaseKey);
      // Trova family e child
      const { data: child } = await sb.from("child_profiles").select("id, family_id").eq("name", "Anna Lettura").single();
      if (child) {
        // Storia 1: In Progress
        const { data: st1 } = await sb.from("stories").insert({
          family_id: child.family_id,
          target_age_range: "6-8",
          generated_text: "# Il Viaggio Magico di Anna\nAnna scoprì un sentiero incantato nel bosco dorato dove gli alberi sussurravano storie antiche e le lucciole indicavano il cammino.",
          source: "ai_generated"
        }).select().single();
        if (st1) {
          await sb.from("story_assignments").insert({
            story_id: st1.id,
            child_profile_id: child.id,
            reading_status: "in_progress",
            last_read_position: 45
          });
        }

        // Storia 2: New
        const { data: st2 } = await sb.from("stories").insert({
          family_id: child.family_id,
          target_age_range: "6-8",
          generated_text: "# L'Isola dei Tesori Incantati\nOltre il mare azzurro scintillava un'isola misteriosa abitata da simpatici delfini parlanti e custodi di gemme incantate.",
          source: "ai_generated"
        }).select().single();
        if (st2) {
          await sb.from("story_assignments").insert({
            story_id: st2.id,
            child_profile_id: child.id,
            reading_status: "new",
            last_read_position: 0
          });
        }

        // Storia 3: Completed
        const { data: st3 } = await sb.from("stories").insert({
          family_id: child.family_id,
          target_age_range: "6-8",
          generated_text: "# La Piccola Stella Esploratrice\nUna stellina coraggiosa scese dal cielo per regalare un sorriso a tutti i bambini della foresta prima di tornare a brillare tra le nubi.",
          source: "ai_generated"
        }).select().single();
        if (st3) {
          await sb.from("story_assignments").insert({
            story_id: st3.id,
            child_profile_id: child.id,
            reading_status: "completed",
            last_read_position: 100
          });
        }
      }
    }

    // Entriamo nella libreria del bambino Anna Lettura
    console.log("8. Navigazione a /child-select e apertura della Libreria Bambino (/read)...");
    await page.goto("http://localhost:3006/child-select", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);

    // Click sulla card di Anna Lettura
    const childCard = page.locator("div.glass-card:has-text('Anna Lettura')");
    if (await childCard.count() > 0) {
      await childCard.first().click();
      await page.waitForTimeout(2000);
    } else {
      await page.goto("http://localhost:3006/read", { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
    }

    // Scatta screenshot della Libreria Bambino con le 3 sezioni ("Continua a leggere", "Novità", "Già lette")
    await takeShot("req_02_child_library_3_sections");

    console.log("Tutti gli screenshot per i Punti 1, 2 e 3 sono stati catturati con successo!");
  } finally {
    await browser.close();
    serverProcess.kill();
  }
}

run().catch((e) => {
  console.error("Errore script Playwright:", e);
  process.exit(1);
});
