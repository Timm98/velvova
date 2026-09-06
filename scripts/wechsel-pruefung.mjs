import { chromium } from "@playwright/test";

/**
 * Steht auf der Jobseite, was der Wechsel wirklich bringt?
 *
 * Der Kreis: aktuelle Stelle eintragen → Jobseite öffnen → dort steht
 * die Differenz nach Steuern, nicht die Differenz der Bruttobeträge.
 *
 * Und der Schritt davor, der genauso zählt: OHNE eingetragene Stelle
 * darf dort keine Zahl stehen, sondern eine Einladung. Eine Differenz
 * gegen ein erfundenes Vergleichsgehalt sähe genauso aus wie eine echte.
 */
const B = "http://localhost:3000";
const JOB = process.argv[2] ?? "8530a5ed-128a-418f-95ac-a286a1235d7f"; // 80.000–92.000 €, DE, EUR
const EIGENES_BRUTTO = 63000;

const b = await chromium.launch();
const p = await b
  .newContext({ viewport: { width: 1440, height: 1400 }, locale: "de-DE" })
  .then((c) => c.newPage());

p.setDefaultTimeout(90000);
p.setDefaultNavigationTimeout(90000);
const text = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");
const zeile = (s, m) => console.log(`  ${s ? "ok  " : "!!  "} ${m}`);

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
const konto = `wechsel-${Date.now()}@example.invalid`;
await p.getByLabel("E-Mail-Adresse").fill(konto);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });
console.log(`  Konto: ${konto}`);

// ── 1. Ohne aktuelle Stelle: eine Einladung, keine Zahl ──
await p.goto(`${B}/app/jobs/${JOB}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
const ohne = await text();
zeile(/Was der Wechsel bringt/.test(ohne), "Der Abschnitt erscheint auf der Jobseite");
zeile(/Aktuelle Stelle hinterlegen/.test(ohne), "Ohne Angaben: Einladung statt Rechnung");
zeile(!/Netto im Monat \+/.test(ohne), "Ohne Angaben: keine erfundene Differenz");
const nettoVorher = /bleiben dir etwa ([\d.]+) €/.exec(ohne);
zeile(Boolean(nettoVorher), `Nettoschätzung steht da${nettoVorher ? `: ${nettoVorher[1]} €` : ""}`);
await p.screenshot({ path: "artifacts/life-fit/wechsel-ohne.png", fullPage: false });

// ── 2. Aktuelle Stelle eintragen ──
await p.goto(`${B}/app/settings/lebenshaltung`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);
await p.getByLabel("Bruttogehalt").fill(String(EIGENES_BRUTTO));
await p.getByLabel("Arbeitsweg je Richtung").fill("35");
await p.getByLabel("Bürotage je Woche").fill("3");
await p.getByLabel("Wochenstunden").fill("35");
await p.getByRole("button", { name: /^Speichern$/ }).first().click();
await p.waitForTimeout(3000);
const eigenes = /Netto im Monat\s*([\d.]+)/.exec(await text());
zeile(Boolean(eigenes), `Eigenes Netto gerechnet${eigenes ? `: ${eigenes[1]} €` : ""}`);

// ── 3. Zurück auf die Jobseite: jetzt die echte Differenz ──
await p.goto(`${B}/app/jobs/${JOB}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
const mit = await text();
const diff = /Netto im Monat ([+-]?[\d.]+)(?: – ([+-]?[\d.]+))? €/.exec(mit);
zeile(Boolean(diff), `Differenz je Monat steht da${diff ? `: ${diff[0].replace("Netto im Monat ", "")}` : ""}`);
zeile(Boolean(diff && diff[2]), "Die Spanne der Anzeige wird als Spanne gezeigt");
const jahr = /Im Jahr ([+-]?[\d.]+)(?: – ([+-]?[\d.]+))? €/.exec(mit);
zeile(Boolean(jahr), `Differenz je Jahr steht da${jahr ? `: ${jahr[0].replace("Im Jahr ", "")}` : ""}`);
zeile(!/Aktuelle Stelle hinterlegen/.test(mit), "Die Einladung ist verschwunden");
zeile(
  /Dein jetziger Weg kostet dich [\d.]+ Stunden im Monat/.test(mit),
  "Nennt die Zeit des jetzigen Wegs aus den eigenen Angaben",
);
zeile(
  /keine Fahrzeit bekannt/.test(mit),
  "Sagt, dass die Fahrzeit der neuen Stelle unbekannt ist — statt sie zu schätzen",
);

/*
 * Die Kernaussage: die Nettodifferenz ist deutlich kleiner als die
 * Bruttodifferenz. Genau darum geht es — 17.000 € mehr brutto sind
 * keine 17.000 € mehr auf dem Konto.
 */
if (diff && nettoVorher) {
  const netto = Number(diff[1].replace(/\./g, ""));
  const bruttoDiff = 80000 - EIGENES_BRUTTO;
  zeile(
    Math.abs(netto) * 12 < bruttoDiff,
    `Netto/Jahr (${Math.round(netto * 12)} €) liegt unter der Bruttodifferenz (${bruttoDiff} €)`,
  );
}
const stunde = /Je Arbeitsstunde ([+-]?[\d.,]+(?: – [+-]?[\d.,]+)?) €/.exec(mit);
zeile(Boolean(stunde), `Stundenwert-Unterschied steht da${stunde ? `: ${stunde[1]} €` : ""}`);
zeile(/statt 35 Wochenstunden/.test(mit), "Nennt die Stundenzahlen, auf denen er beruht");
await p.screenshot({ path: "artifacts/life-fit/wechsel-mit.png", fullPage: false });
await b.close();
