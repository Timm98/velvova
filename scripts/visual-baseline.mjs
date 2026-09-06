import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Screenshots der echten Routen — vorher und nachher.
 *
 * Der Anlass ist unangenehm und lehrreich: mehrere Abschlussberichte
 * meldeten „umgesetzt", während im Browser die alte Oberfläche stand.
 * Der Grund war jedes Mal derselbe — geändert wurde eine Komponente,
 * gerendert wurde eine andere.
 *
 * Ein Screenshot der echten URL kann das nicht. Er zeigt, was ankommt.
 *
 *   node scripts/visual-baseline.mjs before
 *   node scripts/visual-baseline.mjs after
 */

const PHASE = process.argv[2] ?? "before";
const B = process.argv[3] ?? "http://localhost:3000";
const ZIEL = `artifacts/visual-${PHASE}`;
mkdirSync(ZIEL, { recursive: true });

const GROESSEN = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

const b = await chromium.launch();

/* Ein Konto, das alle Aufnahmen teilen — sonst unterscheiden sich die
   Bilder durch verschiedene Profilstände statt durch das Layout. */
const setup = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const sp = await setup.newPage();
await sp.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await sp.getByLabel("E-Mail-Adresse").fill(`visual-${Date.now()}@example.invalid`);
await sp.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await sp.getByRole("button", { name: /Konto anlegen/i }).click();
await sp.waitForURL(/\/(app|setup)/, { timeout: 40000 });

/* Eine echte Job-Kennung aus der Liste holen — nicht raten. */
await sp.goto(`${B}/app/jobs`, { waitUntil: "networkidle" });
const jobId =
  (await sp.locator("[data-job-id]").first().getAttribute("data-job-id")) ?? null;
const state = await setup.storageState();
await setup.close();

const ROUTEN = [
  ["landing", "/"],
  ["heute", "/app"],
  ["nina", "/app/nina"],
  ["jobs", "/app/jobs"],
  ...(jobId ? [["jobs-auswahl", `/app/jobs?job=${jobId}`]] : []),
  ...(jobId ? [["jobdetail", `/app/jobs/${jobId}`]] : []),
  ["bewerbungen", "/app/applications"],
  ["profil", "/app/career"],
  ["einstellungen", "/app/settings"],
  ["plan", "/app/settings/abo"],
];

console.log(`Phase: ${PHASE} → ${ZIEL}`);
if (!jobId) console.log("  (keine Stelle in der Liste — Jobdetail wird übersprungen)");

for (const g of GROESSEN) {
  const ctx = await b.newContext({
    viewport: { width: g.width, height: g.height },
    storageState: state,
    /* Bewegung aus: eine Animation mitten im Bild macht zwei Aufnahmen
       unvergleichbar, ohne dass sich das Layout geändert hätte. */
    reducedMotion: "reduce",
  });
  const p = await ctx.newPage();

  for (const [name, pfad] of ROUTEN) {
    try {
      await p.goto(`${B}${pfad}`, { waitUntil: "networkidle", timeout: 60000 });
      // Kurz warten: gestreamte Inhalte und das GLB brauchen einen Moment.
      await p.waitForTimeout(1500);
      const datei = `${ZIEL}/${name}-${g.name}.png`;
      await p.screenshot({ path: datei, fullPage: true });
      const text = (await p.locator("body").innerText()).replace(/\s+/g, " ");
      console.log(
        `  ${datei}` +
          (/schiefgegangen/i.test(text) ? "   !! FEHLERSEITE" : "") +
          (/das ist keine schlechte Angabe/.test(text) ? "   !! altes Gehalt-Wording" : ""),
      );
    } catch (e) {
      console.log(`  ${name}-${g.name}: ${String(e).slice(0, 80)}`);
    }
  }
  await ctx.close();
}

await b.close();
