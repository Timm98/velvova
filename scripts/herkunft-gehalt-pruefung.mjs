import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";

/**
 * Steht an jeder Gehaltszahl, woher sie stammt?
 *
 * „75.000 €" und „75.000 €" sehen gleich aus. Das eine hat ein
 * Arbeitgeber geschrieben, das andere ein Portal geschätzt. Wer mit der
 * zweiten Zahl verhandelt, verhandelt gegen eine Vermutung.
 */
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const holen = async (herkunft) =>
  (await db.execute(sql`
    select id, title, salary_min, salary_max, salary_provenance from jobs
    where salary_provenance = ${herkunft} and (salary_min is not null or salary_max is not null)
    limit 1`)).rows[0] ?? null;

const [ausText, vomPortal, vomArbeitgeber] = await Promise.all([
  holen("text"), holen("provider"), holen("employer"),
]);

const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1100 }, locale: "de-DE" }).then((c) => c.newPage());
p.setDefaultTimeout(90000);
p.setDefaultNavigationTimeout(90000);
const text = async () => (await p.locator("main").innerText()).replace(/\s+/g, " ");
const zeile = (s, m) => console.log(`  ${s ? "ok  " : "!!  "} ${m}`);

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`herk-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });

// ══ Im Detail ══════════════════════════════════════════════
for (const [job, was, erwartet, zusage] of [
  /*
   * Ohne Rücksicht auf Gross-/Kleinschreibung.
   *
   * Die Überschrift trägt `uppercase` als CSS, und `innerText` liefert
   * den GERENDERTEN Text — „GEHALT · VOM ARBEITGEBER ANGEGEBEN".
   */
  [vomArbeitgeber, "Arbeitgeberangabe", /vom Arbeitgeber angegeben/i, true],
  [ausText, "aus dem Anzeigentext", /in der Anzeige genannt/i, true],
  [vomPortal, "Portalangabe", /vom Stellenportal übernommen/i, false],
]) {
  if (!job) { zeile(false, `${was}: keine Stelle in den Daten`); continue; }
  await p.goto(`${B}/app/jobs/${job.id}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(4000);
  const t = await text();
  zeile(erwartet.test(t), `${was}: „${erwartet.source.replace(/\\\\/g, "")}“ steht im Detail`);
  if (!zusage) {
    zeile(/Wer sie ursprünglich genannt hat|geschätzt/i.test(t),
      `${was}: ein Satz sagt, dass es keine Zusage ist`);
  } else {
    zeile(!/keine Zusage|ursprünglich genannt hat/i.test(t),
      `${was}: KEIN unnötiger Vorbehalt`);
  }
}

// ══ In der Liste ═══════════════════════════════════════════
await p.goto(`${B}/app/jobs?sort=highest_salary`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(5000);
const t = await text();
const marker = ["vom Arbeitgeber", "aus der Anzeige", "laut Portal", "geschätzt"].filter((m) => t.includes(m));
zeile(marker.length > 0, `In der Trefferliste steht die Herkunft an der Zahl (${marker.join(", ") || "keine"})`);
zeile(!/vom Arbeitgeber angegeben.{0,40}laut Portal/.test(t), "Die Kennzeichnungen sind nicht vermischt");

await p.screenshot({ path: "artifacts/kern/gehalt-herkunft-liste.png" });
if (vomPortal) {
  await p.goto(`${B}/app/jobs/${vomPortal.id}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: "artifacts/kern/gehalt-herkunft-detail.png" });
}
await b.close();
process.exit(0);
