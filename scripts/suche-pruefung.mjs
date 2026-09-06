import { chromium } from "@playwright/test";

/**
 * Findet die Suche, was im Bestand steht?
 *
 * Der Fehler, den das prüft: Der Suchbegriff filterte erst NACH der
 * Bewertung. Bewertet wurden aber nur die 2.000 neuesten Stellen —
 * „Data Engineer" fand damit null von 996 vorhandenen, und die leere
 * Liste sah aus wie ein leerer Arbeitsmarkt.
 */
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1100 }, locale: "de-DE" }).then(c => c.newPage());
p.setDefaultTimeout(120000); p.setDefaultNavigationTimeout(120000);
let fehler = 0;
const zeile = (ok, m) => { console.log(`  ${ok ? "ok  " : "!!  "} ${m}`); if (!ok) fehler++; };

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`su-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 120000 });

for (const begriff of ["Data Engineer", "Erzieher", "Zerspanungsmechaniker"]) {
  await p.goto(`${B}/app/jobs?q=${encodeURIComponent(begriff)}`, { waitUntil: "domcontentloaded" });
  await p.locator("[data-job-id]").first().waitFor({ timeout: 60000 }).catch(() => {});
  const treffer = await p.locator("[data-job-id]").count();
  zeile(treffer > 0, `„${begriff}" findet Stellen (${treffer} sichtbar)`);
}

await p.goto(`${B}/app/jobs?q=Xyzzyquux`, { waitUntil: "domcontentloaded" });
await p.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 60000 }).catch(() => {});
const t = (await p.locator("main").innerText()).replace(/\s+/g, " ");
zeile(await p.locator("[data-job-id]").count() === 0, "Ein Unsinnswort findet nichts");
zeile(/keine|nichts|0 Stellen|Filter/i.test(t), "Und die Seite sagt, warum sie leer ist");

await b.close();
console.log(fehler === 0 ? "\nAlle Prüfungen bestanden." : `\n${fehler} fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
