import { chromium } from "@playwright/test";

/**
 * Screenshots der Hauptseiten.
 *
 * Einmal anmelden, danach dieselbe Sitzung für alle Ziele. Die erste
 * Fassung legte je Ziel ein Konto an — mit derselben Adresse, was ab
 * dem zweiten Aufruf fehlschlug und wie ein Produktfehler aussah.
 *
 *   node scripts/schau.mjs '[{"name":"today","pfad":"/app"}]' [--anmelden]
 */
const B = "http://localhost:3000";
const ZIELE = JSON.parse(process.argv[2]);
const anmelden = process.argv.includes("--anmelden");

const b = await chromium.launch();
let zustand;

if (anmelden) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" });
  const p = await ctx.newPage();
  await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
  await p.getByLabel("E-Mail-Adresse").fill(`schau-${Date.now()}@example.invalid`);
  await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
  await p.getByRole("button", { name: /Konto anlegen/i }).click();
  await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });
  zustand = await ctx.storageState();
  await ctx.close();
}

for (const z of ZIELE) {
  const ctx = await b.newContext({
    viewport: z.mobil ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
    locale: "de-DE",
    storageState: zustand,
  });
  const p = await ctx.newPage();
  await p.goto(`${B}${z.pfad}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(z.warten ?? 2500);
  await p.screenshot({ path: `artifacts/phase17/${z.name}.png`, fullPage: !!z.voll });
  const t = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  console.log(`  ${z.name.padEnd(16)} ${String(t.length).padStart(5)} Zeichen  ${new URL(p.url()).pathname}`);
  await ctx.close();
}
await b.close();
