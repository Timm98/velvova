import { chromium } from "@playwright/test";

/**
 * Stehen die Leistungen auf der Jobseite — mit Beleg?
 *
 * Und die Gegenrichtung, die genauso zählt: Eine Anzeige ohne
 * Leistungsangaben darf keine Karten zeigen, sondern muss sagen, dass
 * nichts dasteht.
 */
const B = "http://localhost:3000";
const MIT = process.argv[2];
const OHNE = process.argv[3];
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1600 }, locale: "de-DE" }).then((c) => c.newPage());
p.setDefaultTimeout(90000);
p.setDefaultNavigationTimeout(90000);
const text = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");
const zeile = (s, m) => console.log(`  ${s ? "ok  " : "!!  "} ${m}`);

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
const konto = `leist-${Date.now()}@example.invalid`;
await p.getByLabel("E-Mail-Adresse").fill(konto);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });
console.log(`  Konto: ${konto}`);

await p.goto(`${B}/app/jobs/${MIT}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
const t = await text();
zeile(/Was die Anzeige bietet/.test(t), "Der Abschnitt erscheint");
const belege = (t.match(/„[^"]{10,}"/g) ?? []).length;
zeile(belege > 0, `Belege aus dem Anzeigentext stehen dabei (${belege} Zitate)`);
zeile(
  /Aus dem Anzeigentext gelesen, nicht bewertet/.test(t),
  "Sagt, dass gelesen und nicht bewertet wurde",
);
zeile(!/€ Gesamtwert|Benefits im Wert von/.test(t), "Erfindet keine Eurosumme für Leistungen");
await p.screenshot({ path: "artifacts/life-fit/leistungen.png", fullPage: false });

if (OHNE) {
  await p.goto(`${B}/app/jobs/${OHNE}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(3000);
  const t2 = await text();
  zeile(/Was die Anzeige bietet/.test(t2), "Der Abschnitt erscheint auch ohne Leistungen");
  zeile(
    /nennt keine Leistungen/.test(t2),
    "Ohne Angaben: sagt es ausdrücklich, statt zu verschwinden",
  );
  zeile(/gute Frage fürs Gespräch/.test(t2), "Und macht daraus eine Gesprächsfrage");
}
await b.close();
