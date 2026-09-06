import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";

/**
 * Die Kernfunktionen — im laufenden Produkt, nicht im Code.
 *
 * Der Auftrag sagt es ausdrücklich: nicht „Salary engine implemented",
 * wenn im Browser kein Rechner steht. Also wird hier geklickt.
 */
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
/*
 * `order by id` — nicht Zierde, sondern Voraussetzung.
 *
 * Hier stand `limit 1` ohne Sortierung. Bei 2.500 Stellen fiel das
 * nicht auf; bei über einer Million nimmt jeder Lauf eine andere
 * Stelle, und ein Fehlschlag liess sich nicht wiederholen. Die
 * Prüfung meldete „keine Fahrzeit", ohne zu sagen, für welchen Ort.
 */
const [mitGehalt] = (await db.execute(sql`
  select id, title, location from jobs
  where salary_min is not null and salary_period = 'year' and country = 'DE'
    and location is not null and location <> '' and location !~* '^(deutschland|germany)$'
  order by id
  limit 1`)).rows;
const [ohneGehalt] = (await db.execute(sql`
  select id, title from jobs where salary_min is null and salary_max is null limit 1`)).rows;

const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1200 }, locale: "de-DE" }).then((c) => c.newPage());
p.setDefaultTimeout(90000);
p.setDefaultNavigationTimeout(90000);
const text = async () => (await p.locator("main").innerText()).replace(/\s+/g, " ");
const zeile = (s, m) => console.log(`  ${s ? "ok  " : "!!  "} ${m}`);

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
const konto = `kern-${Date.now()}@example.invalid`;
await p.getByLabel("E-Mail-Adresse").fill(konto);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });
console.log(`  Konto: ${konto}\n  Stelle mit Gehalt: ${mitGehalt?.title?.slice(0,50)}\n`);

// ══ Jobliste ═══════════════════════════════════════════════
await p.goto(`${B}/app/jobs`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(4000);
let t = await text();

zeile(!/Passung nicht berechenbar/.test(t), "„Passung nicht berechenbar“ ist verschwunden");
zeile(/Passung noch offen/.test(t), "Stattdessen: „Passung noch offen“");
zeile(!/Datenbasis zu dünn/.test(t), "„Datenbasis zu dünn“ ist verschwunden");
zeile(/passende Stellen/.test(t), "Die Zahl der passenden Stellen steht oben");

const roteBalken = await p.locator('main [class*="bg-critical"]').count();
zeile(roteBalken === 0, `Keine roten Balken bei unbekannter Datenlage (${roteBalken})`);

zeile(!/Seite \d+ von \d+/.test(t), "Keine Seitenzahlen mehr");
zeile(!/Warum sehe ich diese Auswahl/.test(t), "Kein Dauer-Link „Warum sehe ich diese Auswahl“");
const weiter = p.getByRole("button", { name: /Weitere \d+ Stellen/ });
zeile(await weiter.count() === 1, "Genau ein „Weitere 25 Stellen“-Knopf");
zeile(await p.getByRole("button", { name: /^Zurück$/ }).count() === 0, "Kein Zurück-Knopf");

// ── Load more ──
const vorher = await p.locator('a[href^="/app/jobs?job="], main li').count();
await weiter.click();
/*
 * Auf die neuen Zeilen warten, nicht auf die Uhr.
 *
 * Hier standen 3,5 Sekunden fest. Das reichte bei 2.500 Stellen und
 * reichte bei 740.000 nicht mehr — die Prüfung meldete „nichts
 * nachgeladen", während das Nachladen noch lief. Eine Wartezeit, die
 * vom Datenbestand abhängt, ist keine Prüfung, sondern eine Wette.
 */
await p
  .locator('a[href^="/app/jobs?job="], main li')
  .nth(vorher)
  .waitFor({ timeout: 60000 })
  .catch(() => {});
const nachher = await text();
zeile(nachher.length > t.length, "Nach dem Klick steht mehr auf der Seite");
zeile(!/Seite \d+ von/.test(nachher), "Immer noch keine Seitenzahl");

// ── Dedup ──
/*
 * Titel PLUS Firma — zwei Unternehmen dürfen dieselbe Stelle
 * ausschreiben. Erst die Kombination ist eine Dublette.
 */
/*
 * Nur die Stellenzeilen, nicht jedes `<li>` der Seite.
 *
 * `main li` traf auch Vorschläge, Navigationspunkte und Aufzählungen —
 * 175 „Dubletten", von denen keine eine war. Die Stellen tragen einen
 * Verweis auf ihre Detailseite; daran erkennt man sie.
 */
const zeilenText = await p.locator('main a[href*="/app/jobs/"]').allInnerTexts();
const schluessel = zeilenText.map((x) => x.split("\n").slice(0, 2).join("|").trim());
const doppelt = schluessel.filter((x, i) => x.length > 10 && schluessel.indexOf(x) !== i);
zeile(doppelt.length === 0, `Keine doppelten Stellen in der Liste (${doppelt.length})`);

// ══ Quick Input ════════════════════════════════════════════
await p.goto(`${B}/app/jobs`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(3000);
const feld = p.getByRole("searchbox").first();
await feld.fill("Nur Stellen ab 45.000 €");
await feld.press("Enter");
/*
 * ── Zuerst auf die Bestätigung, dann auf den Chip ─────────
 *
 * Ninas Bestätigung lebt vier Sekunden — so ist sie gebaut, und die
 * Prüfung weiter unten verlangt genau das.
 *
 * Hier stand zuerst das Warten auf den Filter-Chip, mit dreissig
 * Sekunden Geduld. Bei einer schnellen Liste ging das gut. Seit die
 * Liste bei 740.000 Stellen mehrere Sekunden braucht, war der Satz
 * weg, bevor überhaupt hingesehen wurde — und die Prüfung meldete ein
 * fehlendes Feature, das die ganze Zeit da war.
 *
 * Die Reihenfolge ist deshalb keine Feinheit: Was flüchtig ist, muss
 * zuerst geprüft werden.
 */
const bestaetigungKam = await p
  .getByText(/hat notiert/)
  .first()
  .waitFor({ state: "visible", timeout: 15000 })
  .then(() => true)
  .catch(() => false);
zeile(bestaetigungKam, "Kurze Nina-Bestätigung erscheint");

await p.locator('ul[aria-label="Aktive Filter"] button').first()
  .waitFor({ state: "visible", timeout: 30000 });

zeile((await feld.inputValue()) === "", "Das Eingabefeld leert sich");
const nachEingabe = await text();
const drawer = await p.locator('[role="dialog"], aside').filter({ hasText: /Nina/ }).count();
zeile(drawer === 0, "Es öffnet sich KEIN Seitenchat");
/* Am Chip selbst prüfen, nicht am Seitentext — der Vorschlagssatz
   enthält denselben Betrag und machte die Prüfung wertlos. */
const chips = await p.locator('ul[aria-label="Aktive Filter"] button').allInnerTexts();
zeile(chips.some((c) => /45\.000/.test(c)), `Ein Filter-Chip zeigt die Bedingung (${chips.join(", ") || "keiner"})`);
zeile(
  !/Nur Stellen ab 45.000 €, wenn das Gehalt angegeben ist\./.test(nachEingabe),
  "Der erledigte Vorschlag verschwindet",
);
await p.waitForTimeout(4500);
zeile(!/hat notiert/.test(await text()), "Die Bestätigung verschwindet wieder");

// ══ Job Detail mit Gehalt ══════════════════════════════════
await p.goto(`${B}/app/jobs/${mitGehalt.id}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(5000);
t = await text();
zeile(/Was bleibt dir netto\?/.test(t), "Abschnitt „Was bleibt dir netto?“ ist da");
/* `innerText` liefert den GERENDERTEN Text — die Beschriftung trägt
   `uppercase`, steht also als „NETTO IM MONAT" da. */
zeile(/netto im monat/i.test(t), "Der Nettobetrag steht sofort da");
zeile(await p.getByRole("button", { name: /Details berechnen/ }).count() === 1, "Knopf „Details berechnen“");
zeile(/Dein Arbeitsweg/.test(t), "Abschnitt „Dein Arbeitsweg“ ist da");
zeile(/Wohnort hinzufügen/.test(t), "Ohne Wohnort steht ein Knopf, nicht nichts");
zeile(/Was bedeutet der Job für deinen Alltag\?/.test(t), "Life-Fit-Abschnitt ist da");
zeile(!/%/.test(t.match(/Was bedeutet der Job für deinen Alltag\?[^§]{0,300}/)?.[0] ?? ""), "Life Fit ohne Prozent-Score");

// Rechner aufklappen
await p.getByRole("button", { name: /Details berechnen/ }).click();
await p.waitForTimeout(1200);
t = await text();
zeile(/Steuerklasse/.test(t) && /Bundesland/.test(t), "Steuerangaben sind einstellbar");
zeile(/Deine monatlichen Kosten/.test(t), "Persönliche Kosten sind eingebbar");
await p.locator('input[aria-label="Wohnen je Monat in Euro"]').fill("1200");
await p.waitForTimeout(900);
t = await text();
zeile(/Dir bleiben ungefähr/.test(t), "„Dir bleiben ungefähr“ erscheint");
await p.screenshot({ path: "artifacts/kern/salary-calculator.png", fullPage: false });

// ══ Wohnort setzen, dann Arbeitsweg ════════════════════════
await p.goto(`${B}/app/settings/language-region`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(2500);
await p.getByLabel("Wohnort").fill("Karlsruhe");
await p.getByRole("button", { name: /Speichern|Übernehmen/i }).first().click();
await p.waitForTimeout(3000);

await p.goto(`${B}/app/jobs/${mitGehalt.id}`, { waitUntil: "domcontentloaded" });
/*
 * Auf die Fahrzeit warten, nicht auf die Uhr.
 *
 * Hier standen acht feste Sekunden. Das reichte, solange der Bestand
 * klein war; bei über einer Million Stellen dauert die Seite länger,
 * und die Prüfung meldete „keine Fahrzeit" für eine Stelle in Bonn —
 * ein Fehlalarm, der nach einem kaputten Routendienst aussah.
 *
 * Eine feste Wartezeit prüft die Geschwindigkeit der Maschine mit,
 * nicht das Verhalten der Seite.
 */
await p.getByText(/\d+ Min\./).first().waitFor({ timeout: 45000 }).catch(() => {});
t = await text();
const fahrt = /(\d+) Min\./.exec(t);
zeile(Boolean(fahrt), `Eine echte Fahrzeit steht da${fahrt ? `: ${fahrt[1]} Min.` : ` (Ort: „${mitGehalt.location}")`}`);
zeile(/Stunden Pendeln im Monat/.test(t), "Und was das im Monat an Zeit kostet");
zeile(!/Wohnort hinzufügen/.test(t), "Der Wohnort-Knopf ist verschwunden");
await p.screenshot({ path: "artifacts/kern/commute-calculator.png", fullPage: false });

// ══ Job ohne Gehalt ════════════════════════════════════════
await p.goto(`${B}/app/jobs/${ohneGehalt.id}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(4000);
t = await text();
zeile(/kein Jahresgehalt|nicht angegeben/.test(t), "Ohne Gehalt: klare Auskunft");
const rot = await p.locator('main [class*="text-critical"], main [class*="bg-critical"]').count();
zeile(rot === 0, `Ohne Gehalt kein roter Fehler (${rot} rote Elemente)`);

await b.close();
process.exit(0);
