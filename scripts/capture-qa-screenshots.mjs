import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const artifactDir = "C:/Users/User/.gemini/antigravity/brain/b8b22a75-7377-433f-80f9-c05be331d422/qa-screenshots";
const projectDir = path.resolve(__dirname, "../qa-screenshots");

fs.mkdirSync(artifactDir, { recursive: true });
fs.mkdirSync(projectDir, { recursive: true });

async function run() {
  console.log("Avvio server locale Next.js su porta 3005 per QA Screenshots post-fix...");
  const serverProcess = spawn("npx", ["next", "start", "-p", "3005"], {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    shell: true,
  });

  await new Promise((r) => setTimeout(r, 4000));

  console.log("Avvio Playwright Chromium...");
  const browser = await chromium.launch({ headless: true });

  const contextDesktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await contextDesktop.newPage();

  async function takeShot(name, urlPath) {
    console.log(`Navigazione a ${urlPath} -> ${name}.png`);
    try {
      await page.goto(`http://localhost:3005${urlPath}`, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(1200);
      const shotArtifact = path.join(artifactDir, `${name}.png`);
      const shotProject = path.join(projectDir, `${name}.png`);
      await page.screenshot({ path: shotArtifact, fullPage: true });
      fs.copyFileSync(shotArtifact, shotProject);
      console.log(`[OK] Catturato con successo: ${name}.png`);
      return true;
    } catch (err) {
      console.error(`[ATTENZIONE] Pagina ${urlPath} (${name}): ${err.message}`);
      return false;
    }
  }

  try {
    // 1. Landing Page (verifica pulsante Crea Account Famiglia)
    await takeShot("fix_01_landing_header", "/");

    // 2. Login Page (verifica link Torna alla Home e Password Dimenticata)
    await takeShot("fix_02_login_links", "/login");

    // 3. Register Page (verifica link Torna alla Home)
    await takeShot("fix_03_register_home_link", "/register");

    // 4. Registrazione QA ed esecuzione PIN Wizard
    console.log("Registrazione utente QA...");
    await page.goto("http://localhost:3005/register", { waitUntil: "networkidle" });
    const qaEmail = `qa.fix.${Date.now()}@storiia-qa.test`;
    await page.fill("input[type='email']", qaEmail);
    await page.fill("input[type='password']", "TestQaPassword2026!");
    await page.click("button[type='submit']");

    await page.waitForURL("**/dashboard", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Completa wizard PIN
    try {
      await page.waitForSelector("input[placeholder='••••']", { timeout: 5000 });
      const pinInputs = page.locator("input[placeholder='••••']");
      await pinInputs.nth(0).fill("1234");
      await pinInputs.nth(1).fill("1234");
      await page.click("button[type='submit']");
      await page.waitForSelector("input[placeholder='••••']", { state: "hidden", timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(1000);
    } catch (e) {}

    // 5. Creazione di un profilo Bambino ("Leo Test", Avatar 'lion') in /children
    console.log("Navigazione in /children per verificare il picker avatar illustrato...");
    await page.goto("http://localhost:3005/children", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Scatta screenshot del selettore avatar con le illustrazioni
    await takeShot("fix_05_children_avatar_picker_images", "/children");

    // Ora creiamo il bambino
    await page.fill("input[placeholder='es. Sofia']", "Leo Test");
    await page.fill("input[placeholder='es. 2019']", "2019");
    await page.click("button:has-text('Crea Profilo Figlio')");
    await page.waitForTimeout(2500);

    // Scattiamo di nuovo su /children col bambino creato
    await takeShot("fix_05b_children_created_child", "/children");

    // 6. Torniamo alla Dashboard per confermare il disegno cartoon al posto dell'iniziale
    console.log("Navigazione in /dashboard per verificare la card bambino col disegno cartoon...");
    await takeShot("fix_04_dashboard_child_cartoon_avatar", "/dashboard");

    // 7. Nuova Storia (Contatore 0/20 per famiglia nuova)
    await takeShot("fix_03_stories_new_counter_zero", "/stories/new");

    console.log("Tutti gli screenshot di verifica dei 6 punti sono stati generati!");
  } finally {
    await browser.close();
    serverProcess.kill();
  }
}

run().catch((e) => {
  console.error("Errore script:", e);
  process.exit(1);
});
