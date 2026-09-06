import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die Entgelt-Referenz im Browser.
 *
 * Geprüft wird nicht, ob der Code kompiliert, sondern ob ein Mensch
 * die Zahl sieht, ihre Herkunft liest und sie nicht mit einer Zusage
 * verwechseln kann. Und die Gegenprobe: dass ein Werkstudium keine
 * Vollzeitspanne bekommt.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

// Eine Stelle ohne eigenes Gehalt, deren Beruf eine Referenz hat.
const [mitReferenz] = (await db.execute(sql`
  select j.id, j.title, e.beruf, e.q1, e.median, e.q3, e.anzahl, e.quelle, e.besetzung
  from jobs j
  join beruf_zuordnung z on z.titel = lower(btrim(regexp_replace(j.title, '\\s*\\(m/w/d\\)|\\s*\\(w/m/d\\)|\\s*m/w/d', '', 'gi')))
  join beruf_entgelt e on e.beruf = z.beruf
  where j.salary_min is null and j.salary_max is null and e.anzahl >= 8
    and j.title !~* 'werkstudent|praktik|ausbildung|azubi|trainee|aushilfe|dual'
  limit 1`)).rows;

if (!mitReferenz) {
  console.log("  !!   Keine Stelle mit Entgelt-Referenz gefunden — Sammellauf noch nicht weit genug.");
  process.exit(1);
}

const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1200 }, locale: "de-DE" }).then((c) => c.newPage());
p.setDefaultTimeout(90000);
p.setDefaultNavigationTimeout(90000);
const text = async () => (await p.locator("main").innerText()).replace(/\s+/g, " ");
const zeile = (s, m) => { console.log(`  ${s ? "ok  " : "!!  "} ${m}`); if (!s) fehler++; };
let fehler = 0;

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`ref-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });

console.log(`  Stelle: „${String(mitReferenz.title).slice(0, 50)}" → ${mitReferenz.beruf}`);
await p.goto(`${B}/app/jobs/${mitReferenz.id}`, { waitUntil: "domcontentloaded" });
await p.getByText(/Vergleichbare Stellen/i).first().waitFor({ timeout: 30000 }).catch(() => {});
let t = await text();

zeile(/Vergleichbare Stellen/i.test(t), "Der Vergleichsblock steht da");
/*
 * Einseitige Spannen sind seit Migration 0040 zulässig.
 *
 * Der Entgeltatlas weist für manche Berufsgattungen einen echten
 * Median aus und lässt ein Quartil offen. `alsSpanne()` schreibt dann
 * „ab 71.352 €" statt einer Grenze, die niemand ausgewiesen hat.
 *
 * Diese Prüfung rechnete `Number(null)` zu 0 und erwartete
 * „71.352 – 0 €" — sie hat also die eigene Verbesserung als Fehler
 * gemeldet.
 */
const eur = (v) => `${Number(v).toLocaleString("de-DE")} €`;
const erwartet =
  mitReferenz.q1 !== null && mitReferenz.q3 !== null
    ? `${eur(mitReferenz.q1)} – ${eur(mitReferenz.q3)}`
    : mitReferenz.q1 !== null
      ? `ab ${eur(mitReferenz.q1)}`
      : mitReferenz.q3 !== null
        ? `bis ${eur(mitReferenz.q3)}`
        : `um ${eur(mitReferenz.median)}`;
zeile(t.includes(erwartet), `Und zeigt genau die Referenzspanne (${erwartet})`);
zeile(/Bundesagentur für Arbeit/i.test(t), "Die Quelle wird genannt: Bundesagentur für Arbeit");
zeile(new RegExp(String(mitReferenz.beruf).replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&"), "i").test(t),
  `Die amtliche Berufsbezeichnung steht dabei („${mitReferenz.beruf}")`);
zeile(/kein Gehalt dieser Stelle/i.test(t), "Es wird ausdrücklich nicht als Stellengehalt ausgegeben");
/*
 * Was hier zu zeigen ist, hängt an der Quelle — und die Verwechslung
 * der beiden wäre eine Falschaussage, keine Unschönheit.
 *
 * Bei eigenen Werten steht hinter `anzahl` die Zahl der Anzeigen mit
 * Gehaltsangabe: „aus 24 Gehaltsangaben". Beim Entgeltatlas steht dort
 * die Zahl der Beschäftigten aus der Beschäftigungsstatistik — 271.572
 * für „Verkäufer/in". Als „271.572 Gehaltsangaben" gelesen behauptete
 * die Seite eine Auswertung von einer Viertelmillion Stellenanzeigen,
 * die es nicht gibt.
 *
 * Genau das ist der Prüfung einmal durchgerutscht, weil sie nur nach
 * der Zahl suchte und nicht danach, wofür sie ausgegeben wird.
 */
if (String(mitReferenz.quelle) === "entgeltatlas") {
  zeile(/Beschäftigungsstatistik/i.test(t), "Der amtliche Wert wird als Beschäftigungsstatistik ausgewiesen");
  zeile(/keine Auswertung von Anzeigen/i.test(t), "Und ausdrücklich nicht als Auswertung von Anzeigen");
  zeile(!new RegExp(`${mitReferenz.anzahl}\\s*Gehaltsangaben`).test(t),
    `Die Beschäftigtenzahl wird nicht als Gehaltsangaben ausgegeben (${mitReferenz.anzahl})`);
} else {
  zeile(new RegExp(`${mitReferenz.anzahl} Gehaltsangaben`).test(t),
    `Die Zahl der Angaben steht dabei (${mitReferenz.anzahl})`);
}

// Gegenprobe: dieselbe Mechanik darf für ein Werkstudium nichts liefern.
const [ws] = (await db.execute(sql`
  select id, title from jobs
  where salary_min is null and salary_max is null and title ~* 'werkstudent|praktikum' limit 1`)).rows;
if (ws) {
  await p.goto(`${B}/app/jobs/${ws.id}`, { waitUntil: "domcontentloaded" });
  await p.getByRole("heading", { level: 1 }).first().waitFor({ timeout: 30000 }).catch(() => {});
  t = await text();
  zeile(!/Vergleichbare Stellen/i.test(t), `Ein Werkstudium bekommt keine Vollzeitspanne („${String(ws.title).slice(0, 40)}")`);
  zeile(/zu wenige Gehaltsangaben/i.test(t), "Stattdessen steht der Grund dort");
}

// Und die Liste: ca.-Spanne mit Kennzeichnung.
await p.goto(`${B}/app/jobs`, { waitUntil: "domcontentloaded" });
/*
 * Auf eine Stellenzeile warten, nicht auf die Uhr.
 *
 * Hier standen drei Sekunden. Das reichte bei 2.500 Stellen und
 * reichte bei 5.400 nicht mehr — die Prüfung meldete „0 Zeilen" und
 * sah wie ein Fehler im Produkt aus, während sie nur zu früh
 * nachgesehen hatte. Eine Wartezeit, die vom Datenbestand abhängt, ist
 * keine Prüfung, sondern eine Wette.
 */
await p
  .locator("[data-job-id]")
  .first()
  .waitFor({ timeout: 60000 })
  .catch(() => {});
/*
 * Weiter blättern, bevor geurteilt wird.
 *
 * Die erste Fassung sah nur die ersten 25 Zeilen an. Seit der Bestand
 * gewachsen ist, tragen die alle ein echtes Gehalt — die Prüfung
 * meldete „0 geschätzte Spannen" und sah wie ein kaputtes Feature aus,
 * während sie nur an der falschen Stelle nachgesehen hatte.
 */
for (let i = 0; i < 3; i++) {
  const knopf = p.getByRole("button", { name: /mehr|weitere/i }).first();
  if (!(await knopf.isVisible().catch(() => false))) break;
  const vorher = await p.locator("[data-job-id]").count();
  await knopf.click();
  await p
    .locator("[data-job-id]")
    .nth(vorher)
    .waitFor({ timeout: 30000 })
    .catch(() => {});
}
const sichtbar = await p.locator("[data-job-id]").count();
const liste = (await p.locator("main").innerText()).replace(/\s+/g, " ");
const caTreffer = (liste.match(/ca\. [\d.]+ – [\d.]+ €/g) ?? []).length;
const nichtAngegeben = (liste.match(/Gehalt nicht angegeben/g) ?? []).length;

console.log(`  ${sichtbar} Zeilen angesehen · mit Schätzung ${caTreffer} · ohne Angabe ${nichtAngegeben}`);
/*
 * Die eigentliche Zusicherung: Wo eine Zahl fehlt, soll möglichst eine
 * Grössenordnung stehen. Stehen in der ganzen Liste überhaupt keine
 * Zeilen ohne Gehalt, ist das kein Fehler, sondern ein guter Bestand —
 * dann gibt es hier nichts zu prüfen, und das steht auch so da.
 */
if (caTreffer === 0 && nichtAngegeben === 0) {
  console.log("  --   Alle sichtbaren Zeilen tragen ein echtes Gehalt; nichts zu schätzen.");
} else {
  zeile(caTreffer > 0, `In der Liste stehen geschätzte Spannen (${caTreffer} Zeilen)`);
  zeile(/Marktspanne|amtlicher Schnitt/i.test(liste), "Und sie sind als Schätzung gekennzeichnet");
}

await b.close();
console.log(fehler === 0 ? "\nAlle Prüfungen bestanden." : `\n${fehler} Prüfung(en) fehlgeschlagen.`);
process.exit(fehler === 0 ? 0 : 1);
