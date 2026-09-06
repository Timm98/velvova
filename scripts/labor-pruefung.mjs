import { chromium } from "@playwright/test";

/**
 * Rechnet das Gehaltslabor, und rechnet es mit DEN EIGENEN Angaben?
 *
 * Der zweite Teil ist der wichtigere. Ein Rechner, der immer mit
 * Steuerklasse I rechnet, während oben III eingestellt ist, gibt eine
 * Zahl aus, die überzeugend aussieht und für jemand anderen gilt —
 * genau der Fehler, der bei der Nettoschätzung auf der Jobseite jahrelang
 * drinsteckte.
 */
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b
  .newContext({ viewport: { width: 1440, height: 1600 }, locale: "de-DE" })
  .then((c) => c.newPage());
p.setDefaultTimeout(90000);
p.setDefaultNavigationTimeout(90000);
const text = async () => (await p.locator("body").innerText()).replace(/\s+/g, " ");
const zeile = (s, m) => console.log(`  ${s ? "ok  " : "!!  "} ${m}`);

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
const konto = `labor-${Date.now()}@example.invalid`;
await p.getByLabel("E-Mail-Adresse").fill(konto);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });
console.log(`  Konto: ${konto}`);

await p.goto(`${B}/app/settings/gehalt`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);

const leer = await text();
zeile(/Was bleibt von einer Erhöhung/.test(leer), "Der Abschnitt erscheint");
zeile(
  /Trag dein heutiges Bruttogehalt ein/.test(leer),
  "Ohne eigenes Gehalt: keine Beispielzahl, sondern die Aufforderung",
);

await p.getByLabel("Heutiges Brutto im Jahr").fill("60000");
await p.waitForTimeout(600);
const t1 = await text();
const netto1 = /bleiben dir ([\d.]+) €/.exec(t1);
const grenze1 = /([\d,]+) % gehen von der Erhöhung ab/.exec(t1);
zeile(Boolean(netto1), `Nettozuwachs steht da${netto1 ? `: ${netto1[1]} €` : ""}`);
zeile(Boolean(grenze1), `Grenzbelastung steht da${grenze1 ? `: ${grenze1[1]} %` : ""}`);
zeile(
  /Von deinem gesamten Gehalt sind es/.test(t1),
  "Die Durchschnittsbelastung steht daneben",
);
if (netto1) {
  const n = Number(netto1[1].replace(/\./g, ""));
  zeile(n > 0 && n < 5000, `Vom Brutto bleibt netto weniger übrig (${n} von 5.000 €)`);
}

// ── Das Zielbrutto ──
await p.getByLabel("Wunschnetto im Monat").fill("3000");
await p.waitForTimeout(600);
const t2 = await text();
const brutto = /brauchst du etwa ([\d.]+) €/.exec(t2);
zeile(Boolean(brutto), `Zielbrutto steht da${brutto ? `: ${brutto[1]} €` : ""}`);
zeile(/Damit kommst du auf ([\d.]+) € netto/.test(t2), "Sagt, was dabei tatsächlich herauskommt");

// ── Und jetzt der Punkt: die Angaben oben wirken ──
await p.getByLabel("Steuerklasse", { exact: true }).selectOption("3");
await p.waitForTimeout(800);
const t3 = await text();
const netto3 = /bleiben dir ([\d.]+) €/.exec(t3);
const brutto3 = /brauchst du etwa ([\d.]+) €/.exec(t3);
zeile(
  Boolean(netto1 && netto3 && Number(netto3[1].replace(/\./g, "")) > Number(netto1[1].replace(/\./g, ""))),
  `Steuerklasse III lässt mehr von der Erhöhung übrig (${netto1?.[1]} → ${netto3?.[1]} €)`,
);
zeile(
  Boolean(brutto && brutto3 && Number(brutto3[1].replace(/\./g, "")) < Number(brutto[1].replace(/\./g, ""))),
  `Und braucht weniger Brutto fürs selbe Netto (${brutto?.[1]} → ${brutto3?.[1]} €)`,
);
zeile(!/gespeichert/i.test(t3) || /Nichts davon wird gespeichert/.test(t3), "Sagt, dass nichts gespeichert wird");

await p.screenshot({ path: "artifacts/life-fit/gehaltslabor.png", fullPage: true });
await b.close();
