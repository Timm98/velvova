import { chromium } from "@playwright/test";

/**
 * Wird aus „35 Minuten" eine Zeitangabe, mit der man rechnen kann?
 *
 * Und: stehen die Fragen zur Anzeige jetzt an einer Stelle, mit der
 * Auskunft daneben, wie viel die Anzeige überhaupt hergibt?
 */
const B = "http://localhost:3000";
const JOB = process.argv[2] ?? "8530a5ed-128a-418f-95ac-a286a1235d7f";
const b = await chromium.launch();
const p = await b
  .newContext({ viewport: { width: 1440, height: 1400 }, locale: "de-DE" })
  .then((c) => c.newPage());
p.setDefaultTimeout(90000);
p.setDefaultNavigationTimeout(90000);
const text = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");
const zeile = (s, m) => console.log(`  ${s ? "ok  " : "!!  "} ${m}`);

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
const konto = `weg-${Date.now()}@example.invalid`;
await p.getByLabel("E-Mail-Adresse").fill(konto);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });
console.log(`  Konto: ${konto}`);

const pfad = `${B}/app/settings/lebenshaltung`;
await p.goto(pfad, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);
zeile(!/Arbeitsweg an Zeit kostet/.test(await text()), "Ohne Angaben: keine Zeitrechnung");

await p.getByLabel("Bruttogehalt").fill("63000");
await p.getByLabel("Arbeitsweg je Richtung").fill("35");
await p.getByLabel("Bürotage je Woche").fill("3");
await p.getByRole("button", { name: /^Speichern$/ }).first().click();
await p.waitForTimeout(3000);

await p.goto(pfad, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);
const t = await text();
zeile(/Arbeitsweg an Zeit kostet/.test(t), "Die Zeitrechnung erscheint");
const jahr = /([\d.]+) Stunden im Jahr/.exec(t);
zeile(Boolean(jahr), `Jahresstunden stehen da${jahr ? `: ${jahr[1]}` : ""}`);
const tage2 = /rund ([\d.]+) Arbeitstage/.exec(t);
zeile(Boolean(tage2), `In Arbeitstagen übersetzt${tage2 ? `: ${tage2[1]}` : ""}`);
zeile(/Zum Vergleich, je Bürotag/.test(t), "Die anderen Bürotage stehen daneben");
zeile(/46 Arbeitswochen/.test(t), "Die Rechengrundlage steht dabei");

// 35 min × 2 × 3 Tage × 46 Wochen / 60 = 161 Stunden
if (jahr) {
  const gemessen = Number(jahr[1].replace(/\./g, ""));
  zeile(Math.abs(gemessen - 161) <= 2, `Die Zahl stimmt (erwartet ~161, gemessen ${gemessen})`);
}
await p.screenshot({ path: "artifacts/life-fit/arbeitsweg.png", fullPage: true });

// ── Fragen auf der Jobseite ──
await p.goto(`${B}/app/jobs/${JOB}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
const j = await text();
const q = /Von (\d+) Grundangaben stehen (\d+) in dieser Anzeige/.exec(j);
zeile(Boolean(q), `Vollständigkeit der Anzeige benannt${q ? `: ${q[2]}/${q[1]}` : ""}`);
zeile(
  !/Welche Gehaltsspanne ist für die Stelle vorgesehen/.test(j),
  "Fragt NICHT nach dem Gehalt, das oben gross dasteht",
);
await b.close();
