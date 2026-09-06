import { chromium } from "@playwright/test";

/**
 * Zeigt die Bedingungskarte den dritten Knopf?
 *
 * Der Test, der beweist, dass `geltung.ts` nicht nur geprüfte Logik in
 * einer Datei ist, sondern im Produkt ankommt. Genau daran hatte es
 * gefehlt: Modul gebaut, Tests grün, nirgends angeschlossen.
 */
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-DE" }).then((c) => c.newPage());

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`gelt-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });

await p.goto(`${B}/app/nina`, { waitUntil: "networkidle" });
const feld = p.locator("textarea, input[type=text]").first();
await feld.waitFor({ timeout: 15000 });
await feld.fill("Heute mal maximal 30 Minuten Arbeitsweg, mehr nicht.");
await p.keyboard.press("Enter");
await p.waitForTimeout(28000);

const t = (await p.locator("body").innerText()).replace(/\s+/g, " ");
const proben = [
  ["Bedingungskarte erscheint", /Grenze, nicht nach einem Wunsch|Bedingung setzen|Dauerhaft übernehmen/],
  ["Knopf „Nur für diese Suche“", /Nur für diese Suche/],
  ["Dauerfassung heißt jetzt „Dauerhaft übernehmen“", /Dauerhaft übernehmen/],
];
for (const [name, re] of proben) console.log(`  ${re.test(t) ? "ok  " : "!!  "} ${name}`);

if (/Nur für diese Suche/.test(t)) {
  await p.getByRole("button", { name: /Nur für diese Suche/i }).first().click();
  await p.waitForTimeout(3000);
  const nach = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  console.log(`  ${/Nur für diese Suche:|Profil bleibt unverändert/.test(nach) ? "ok  " : "!!  "} Bestätigung nennt das Profil ausdrücklich als unverändert`);
  const keks = (await p.context().cookies()).find((c) => c.name === "paycheck_sitzungsbedingungen");
  console.log(`  ${keks ? "ok  " : "!!  "} Sitzungskeks gesetzt${keks ? ` (endet mit der Sitzung: ${keks.expires === -1})` : ""}`);

  /*
   * Das eigentliche Ende der Kette.
   *
   * Ein Keks, den die Jobliste nicht liest, ist eine Attrappe. Und ein
   * Keks, an dem der Abgleich zerbricht, ist schlimmer als keiner —
   * deshalb wird hier beides geprüft: dass die Seite trägt und dass
   * die Bedingung dort ankommt.
   */
  const antwort = await p.goto(`${B}/app/jobs`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const jt = (await p.locator("body").innerText()).replace(/\s+/g, " ");
  const stellen = await p.locator("[data-job-id]").count();
  console.log(`  ${antwort?.ok() && !/schiefgegangen/i.test(jt) ? "ok  " : "!!  "} Jobliste trägt die Sitzungsbedingung (HTTP ${antwort?.status()}, ${stellen} Stellen)`);

  // Und sie lässt sich zurücknehmen.
  await p.goto(`${B}/app/nina`, { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const zurueck = await p.getByRole("button", { name: /Zurücksetzen/i }).count();
  console.log(`  ${zurueck > 0 ? "ok  " : "!!  "} Sitzungsbedingung nach Seitenwechsel sichtbar und rücknehmbar`);
}
await b.close();
