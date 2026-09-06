import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Welche Suchachse bei der Bundesagentur noch Unbekanntes liefert?
 *
 * Nur suchen, nicht importieren: Die Referenznummern aus der Antwort
 * gegen den eigenen Bestand halten. Ein Lauf, der 459 Anzeigen holt
 * und null neue schreibt, kostet 156 Sekunden — diese Messung kostet
 * eine Sekunde je Achse.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [q] = (await db.execute(sql`select id from job_sources where key = 'bundesagentur'`)).rows;

const K = { "X-API-Key": "jobboerse-jobsuche", "User-Agent": "Paycheck/1.0" };
const ACHSEN = [
  ["Grossstadt Berlin",        { was: "Verkäufer", wo: "Berlin", umkreis: "50" }],
  ["Kleinstadt Prenzlau",      { was: "Verkäufer", wo: "Prenzlau", umkreis: "25" }],
  ["Kleinstadt Wittenberge",   { was: "Pflege", wo: "Wittenberge", umkreis: "25" }],
  ["seltener Beruf",           { was: "Orthopädietechnik-Mechaniker" }],
  ["Zeitarbeit",               { was: "Helfer", zeitarbeit: "true" }],
  ["Ausbildung",               { was: "Ausbildung", angebotsart: "4" }],
  ["nur neue (7 Tage)",        { was: "Verkäufer", veroeffentlichtseit: "7" }],
  ["Minijob",                  { was: "Aushilfe", arbeitszeit: "mj" }],
  ["Homeoffice",               { was: "Sachbearbeitung", arbeitszeit: "ho" }],
];

for (const [name, params] of ACHSEN) {
  const url = new URL("https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("size", "100");
  url.searchParams.set("page", "1");
  try {
    const a = await fetch(url, { headers: K, signal: AbortSignal.timeout(25000) });
    if (!a.ok) { console.log(`${name.padEnd(26)} HTTP ${a.status}`); continue; }
    const d = await a.json();
    const refs = (d.ergebnisliste ?? []).map((s) => s.referenznummer).filter(Boolean);
    if (refs.length === 0) { console.log(`${name.padEnd(26)} keine Treffer`); continue; }
    /* `= any()` mit einem JS-Array braucht einen Array-Parameter, den
       der Treiber nicht aus einer Vorlage baut. Also als Liste. */
    const liste = sql.join(refs.map((r) => sql`${r}`), sql`, `);
    const bekannt = (await db.execute(sql`
      select count(*)::int n from job_source_links
      where source_id = ${q.id}::uuid and external_id in (${liste})`)).rows[0].n;
    const gesamt = d.maxErgebnisse ?? 0;
    console.log(`${name.padEnd(26)} ${String(gesamt).padStart(8)} gesamt · Stichprobe ${refs.length} · davon neu ${refs.length - bekannt}`);
  } catch (e) {
    console.log(`${name.padEnd(26)} Fehler: ${String(e.message ?? e).slice(0, 50)}`);
  }
  await new Promise((r) => setTimeout(r, 900));
}
