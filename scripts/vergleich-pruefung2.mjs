import { chromium } from "@playwright/test";
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
/* Eine gewöhnliche Vollzeitstelle — kein Werkstudium, kein Praktikum. */
const [ohne] = (await db.execute(sql`
  select id, title from jobs
  where salary_min is null and salary_max is null
    and (title ~* 'entwickl|software|engineer' or title ~* 'vertrieb|sales')
    and title !~* 'werkstudent|praktik|ausbildung|azubi|trainee|aushilfe|dual'
  limit 1`)).rows;

/* Und eine Ausbildungsstelle — die darf KEINEN Vergleichswert bekommen. */
const [werkstudent] = (await db.execute(sql`
  select id, title from jobs
  where salary_min is null and salary_max is null and title ~* 'werkstudent|praktikum'
  limit 1`)).rows;
const [mit] = (await db.execute(sql`select id from jobs where salary_min is not null limit 1`)).rows;

const B = "http://localhost:3000";
const b = await chromium.launch();
const p = await b.newContext({ viewport: { width: 1440, height: 1200 }, locale: "de-DE" }).then((c) => c.newPage());
p.setDefaultTimeout(90000);
p.setDefaultNavigationTimeout(90000);
const text = async () => (await p.locator("main").innerText()).replace(/\s+/g, " ");
const zeile = (s, m) => console.log(`  ${s ? "ok  " : "!!  "} ${m}`);

await p.goto(`${B}/register`, { waitUntil: "domcontentloaded" });
await p.getByLabel("E-Mail-Adresse").fill(`vgl2-${Date.now()}@example.invalid`);
await p.getByLabel("Passwort", { exact: false }).first().fill("ProbeProbe1234!");
await p.getByRole("button", { name: /Konto anlegen/i }).click();
await p.waitForURL(/\/(app|setup)/, { timeout: 60000 });

console.log(`  Stelle ohne Gehalt: „${ohne?.title?.slice(0,46)}"`);
await p.goto(`${B}/app/jobs/${ohne.id}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(5000);
let t = await text();
zeile(/Vergleichbare Stellen/i.test(t), "Bei fehlendem Gehalt steht ein Vergleichswert");
const spanne = /Vergleichbare Stellen ([\d.]+ € – [\d.]+ €)/i.exec(t);
zeile(Boolean(spanne), `Die Spanne steht da${spanne ? `: ${spanne[1]}` : ""}`);
/*
 * Die Grundlage — in einer der drei Formulierungen.
 *
 * Seit es drei Quellen gibt, steht dort je nach Herkunft ein anderer
 * Satz: die amtliche Statistik, die ausgewerteten Anzeigen der
 * Bundesagentur, oder der eigene Bestand. Die alte Prüfung kannte nur
 * die dritte und wurde rot, obwohl die Grundlage dastand.
 */
zeile(
  /vergleichbaren Stellen mit Gehaltsangabe|Gehaltsangaben in Anzeigen der Bundesagentur|laut Entgeltatlas/.test(t),
  "Die Grundlage wird genannt",
);
zeile(/kein Gehalt dieser Stelle/.test(t), "Es wird ausdrücklich nicht als Stellengehalt ausgegeben");
zeile(/höchstens zwei/.test(t), "Und die Kappung je Arbeitgeber steht dabei");
await p.screenshot({ path: "artifacts/kern/gehalt-vergleichswert.png" });

await p.goto(`${B}/app/jobs/${mit.id}`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(4000);
t = await text();
zeile(!/Vergleichbare Stellen/i.test(t), "Neben einer echten Zahl steht KEIN Vergleichswert");

if (werkstudent) {
  await p.goto(`${B}/app/jobs/${werkstudent.id}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(4000);
  const w = await text();
  zeile(
    !/Vergleichbare Stellen/i.test(w),
    `Werkstudium/Praktikum bekommt KEINEN Vollzeitvergleich („${werkstudent.title.slice(0, 34)}")`,
  );
}

/* Eine Stelle aus einer Gruppe, für die uns die Basis fehlt. */
const [duenn] = (await db.execute(sql`
  select id, title from jobs
  where salary_min is null and salary_max is null
    and (title ~* 'pflege|lehrer|dozent|erzieh|labor|forschung|personalreferent')
    and title !~* 'werkstudent|praktik|ausbildung|azubi'
  limit 1`)).rows;
if (duenn) {
  await p.goto(`${B}/app/jobs/${duenn.id}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(4000);
  const d = await text();
  zeile(!/Vergleichbare Stellen/i.test(d), `Ohne Basis kein erfundener Wert („${duenn.title.slice(0,32)}")`);
  zeile(/zu wenige Gehaltsangaben vor/.test(d), "Stattdessen steht der Grund da");
  zeile(/geschätzt wird nichts/.test(d), "Und dass nicht geschätzt wird");
}

// ── Ranking ──
await p.goto(`${B}/app/jobs`, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(5000);
const werte = (await p.locator("main").innerText()).match(/\n(\d{2})\nQualität/g) ?? [];
const zahlen = werte.map((x) => Number(x.match(/\d+/)[0]));
zeile(zahlen.length >= 5, `Die Liste zeigt Qualitätswerte (${zahlen.length} sichtbar)`);
zeile(new Set(zahlen).size > 1, `Sie unterscheiden sich (${[...new Set(zahlen)].slice(0,6).join(", ")})`);
zeile(
  zahlen.every((z, i) => i === 0 || zahlen[i - 1] >= z),
  `Und sind absteigend sortiert (${zahlen.slice(0, 6).join(" ≥ ")})`,
);
await b.close();
process.exit(0);
