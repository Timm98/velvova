/**
 * Wie viele der sichtbaren Stellen tragen ein negatives Signal? (§58)
 *
 * Gemessen an dem, was auf dem Bildschirm steht — nicht an dem, was die
 * Bewertung intern denkt. Der Vorwurf lautete „fast jeder Job bekommt
 * rote Signale", und das lässt sich nur dort prüfen, wo es auffällt.
 */
import { chromium } from "@playwright/test";
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1200 }, locale: "de-DE" }).then((c) => c.newPage());
await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`rot-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });
/*
 * Über mehrere Seiten messen.
 *
 * Die erste Fassung sah nur die ersten 25 Stellen. Nach der Korrektur
 * meldete sie „0 % mit Warnsignal" — was genauso verdächtig ist wie
 * 100 %: Ein Signal, das nie feuert, ist so nutzlos wie eines, das
 * immer feuert. In den Daten liegen 83 Remote-Stellen und 41 ältere
 * Anzeigen; sie müssen irgendwo auftauchen.
 */
const sammeln = { gesamt: 0, mitSignal: 0, gehaltGezeigt: 0, gehaltFehlt: 0, signale: new Map() };
for (const seite of [1, 2, 3, 4]) {
await p.goto(`${B}/app/jobs?seite=${seite}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);

const zahlen = await p.evaluate(() => {
  const karten = [...document.querySelectorAll("[data-job-id]")];
  const zaehl = { gesamt: karten.length, mitSignal: 0, gehaltGezeigt: 0, gehaltFehlt: 0 };
  const texte = new Map();
  for (const k of karten) {
    const t = (k.textContent ?? "").replace(/\s+/g, " ");
    if (/⚠|Dünne Datenlage|Harte Bedingung|womöglich veraltet/.test(t)) zaehl.mitSignal++;
    if (/Gehalt nicht angegeben/.test(t)) zaehl.gehaltFehlt++;
    else if (/€/.test(t)) zaehl.gehaltGezeigt++;
    const m = /(Dünne Datenlage|Harte Bedingung verletzt|Anzeige womöglich veraltet|Vollständig remote|Starker Aufgaben-Fit|Starke Passung[^·]*)/.exec(t);
    if (m) texte.set(m[1].trim(), (texte.get(m[1].trim()) ?? 0) + 1);
  }
  return { ...zaehl, signale: [...texte.entries()] };
});
sammeln.gesamt += zahlen.gesamt;
sammeln.mitSignal += zahlen.mitSignal;
sammeln.gehaltGezeigt += zahlen.gehaltGezeigt;
sammeln.gehaltFehlt += zahlen.gehaltFehlt;
for (const [t, n] of zahlen.signale) sammeln.signale.set(t, (sammeln.signale.get(t) ?? 0) + n);
}

console.log(`  ${sammeln.gesamt} sichtbare Stellen über 4 Seiten`);
console.log(`  ${sammeln.mitSignal} mit Warnsignal  (${Math.round(sammeln.mitSignal / sammeln.gesamt * 100)} %)`);
console.log(`  ${sammeln.gehaltGezeigt} mit Gehaltsangabe · ${sammeln.gehaltFehlt} ohne`);
console.log(`\n  Verteilung der Signale:`);
for (const [t, n] of [...sammeln.signale.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(3)}×  ${t}`);
await b.close();
