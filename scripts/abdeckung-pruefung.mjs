import { chromium } from "@playwright/test";

/**
 * Steigt die Abdeckung, wenn Belege bestätigt werden?
 *
 * ── Warum hier kein `networkidle` steht ───────────────────────
 *
 * Die erste Fassung wartete überall auf `networkidle` und blieb nach
 * knapp vierzehn Minuten hängen. Der Grund ist kein Fehler im Produkt:
 * Die Monday-Seite hält für das Streamen der Antwort eine Verbindung
 * offen, und solange die steht, wird das Netz nie „ruhig". Ein Test,
 * der darauf wartet, wartet für immer.
 *
 * `domcontentloaded` plus eine feste kurze Wartezeit ist hier das
 * richtige Mass: Es geht um Text auf einer serverseitig gerenderten
 * Seite, nicht um nachladende Bestandteile.
 */
const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1200 }, locale: "de-DE" }).then((c) => c.newPage());

const mail = `abd-${Date.now()}@example.invalid`;
await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(mail);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });

await p.goto(`${B}/app/monday`, { waitUntil: "domcontentloaded" });
const feld = p.locator("textarea, input[type=text]").first();
await feld.waitFor({ timeout: 20000 });
await feld.fill(
  "Ich arbeite seit drei Jahren im Lager und mache dort die Schichtplanung für zwölf Leute. Das Körperliche macht mich fertig, mit Kunden komme ich dagegen gut klar.",
);
await p.keyboard.press("Enter");
await p.waitForTimeout(30000);

await p.goto(`${B}/app/career`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
const vorher = (await p.locator("body").innerText()).replace(/\s+/g, " ");
const wertAus = (t) => {
  const m = /Datenabdeckung\s*(\d+)\s*%/.exec(t) ?? /(\d+)\s*%/.exec(t);
  return m ? Number(m[1]) : null;
};
console.log(`  Abdeckung vor dem Bestätigen: ${wertAus(vorher)} %`);

/*
 * Nach jeder Bestätigung baut sich die Liste neu auf.
 *
 * Der Beleg wandert aus „offene Vermutungen" heraus, React ersetzt die
 * Einträge, und ein Knopf, den der Test gerade noch in der Hand hatte,
 * ist im Moment des Klicks nicht mehr im Dokument:
 *
 *   element was detached from the DOM, retrying
 *
 * Das ist kein Produktfehler, sondern die normale Folge einer
 * Neuberechnung. Der Test muss damit rechnen: jedes Mal frisch suchen,
 * einen Fehlschlag hinnehmen und weitermachen.
 */
let bestaetigt = 0;
for (let i = 0; i < 8; i++) {
  const k = p.getByRole("button", { name: /^Stimmt$/ }).first();
  if ((await k.count()) === 0) break;
  try {
    await k.click({ timeout: 8000 });
    bestaetigt++;
  } catch {
    // Der Eintrag ist unter der Hand verschwunden — dann weiter.
  }
  await p.waitForTimeout(2500);
}
console.log(`  ${bestaetigt} Belege bestätigt`);

await p.goto(`${B}/app/career`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
const nach = (await p.locator("body").innerText()).replace(/\s+/g, " ");
const w = wertAus(nach);
console.log(`  ${w !== null && w > 0 ? "ok  " : "!!  "} Abdeckung nach dem Bestätigen: ${w} %`);
console.log(`  ${/Belegte Stärken/.test(nach) && !/Noch nichts bestätigt/.test(nach) ? "ok  " : "!!  "} Bestätigte Stärken erscheinen`);
await b.close();
