/**
 * Was tatsächlich in der Datenbank steht — je Quelle.
 *
 * Die Frage, die kein Bericht beantworten kann und jede Zahl im
 * Produkt voraussetzt. Der Importlauf meldete monatelang „10 neu" und
 * schrieb dabei in eine lokale Datei; erst diese Abfrage zeigt, wo die
 * Stellen wirklich liegen.
 *
 *   node scripts/jobs-bestand.mjs
 */
/*
 * Relative Pfade, keine Paketnamen.
 *
 * Im Wurzelverzeichnis gibt es keine `node_modules/@paycheck`-Verweise —
 * die Arbeitsbereichspakete sind je Paket verlinkt. Ein Skript hier
 * oben löst `@paycheck/config` deshalb nicht auf. Dieselbe Regel gilt
 * für alle Skripte in diesem Verzeichnis.
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
const env = ladeEnvDatei();

const { getDb } = await import("../packages/db/src/index.ts");
const { loadRuntimeConfig } = await import("../packages/config/src/index.ts");
/*
 * `drizzle-orm` liegt in `packages/db/node_modules`, nicht im
 * Wurzelverzeichnis. Ein Skript hier oben findet es nur über das Paket,
 * das es als Abhängigkeit führt.
 */
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");

const cfg = loadRuntimeConfig();
console.log(
  `Umgebung: ${env.geladen ? ".env.local geladen" : "keine .env.local"} · ` +
    `Datenbank: ${cfg.db.driver === "pg" ? "Postgres (extern)" : "PGlite (lokale Datei)"}\n`,
);

const db = await getDb();
const r = await db.execute(sql`
  select s.display_name, count(*)::int as n,
         count(*) filter (where j.salary_disclosed)::int as mit_gehalt,
         max(j.fetched_at) as zuletzt
  from jobs j join job_sources s on s.id = j.source_id
  group by 1 order by 2 desc
`);

const zeilen = r.rows ?? r;
if (zeilen.length === 0) {
  console.log("Keine Stellen gespeichert.");
} else {
  console.log("Quelle                     Stellen  mit Gehalt  zuletzt geholt");
  for (const z of zeilen) {
    const d = z.zuletzt ? new Date(z.zuletzt).toLocaleString("de-DE") : "—";
    console.log(`  ${String(z.display_name).padEnd(24)} ${String(z.n).padStart(5)} ${String(z.mit_gehalt).padStart(11)}  ${d}`);
  }
  const gesamt = zeilen.reduce((s, z) => s + z.n, 0);
  console.log(`\n${gesamt} Stellen gesamt.`);
}
process.exit(0);
