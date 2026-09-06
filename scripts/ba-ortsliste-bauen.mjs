import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die Ortsliste für die Bundesagentur-Ernte einmal auszählen.
 *
 * ── Warum eine eigene Tabelle ─────────────────────────────────
 *
 * Das Gruppieren über 1,58 Mio. Zeilen dauert Minuten und bricht unter
 * Importlast in die Zeitgrenze. Der Erntelauf braucht die Liste aber
 * bei jedem Start. Einmal rechnen, dann nachschlagen.
 *
 * ── Warum Ortsnamen und keine Postleitzahlen ──────────────────
 *
 * Ich hatte es mit erfundenen Postleitzahlen versucht — „01000",
 * „02000" und so weiter. 48 von 50 Bereichen kamen leer zurück: Die
 * Zahlen gibt es nicht. Echte Postleitzahlen stehen nirgends in
 * unseren Daten; Ortsnamen schon, bis hinunter zu Frammersbach und
 * Harsewinkel.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

await db.execute(sql`
  create table if not exists ba_ortsliste (
    ort text primary key,
    bekannt integer not null,
    zuletzt_geerntet timestamptz,
    ertrag integer not null default 0
  )`);

/* Diese eine Abfrage darf länger laufen als der Normalfall. */
await db.execute(sql`set statement_timeout = '900s'`);
console.log("zähle aus …");
console.time("gruppieren");
const r = (await db.execute(sql`
  select split_part(location, ',', 1) ort, count(*)::int n
  from jobs
  where country = 'DE' and location is not null and location <> ''
  group by 1 having count(*) >= 2`)).rows;
console.timeEnd("gruppieren");
console.log(`${r.length.toLocaleString("de-DE")} Orte`);

let geschrieben = 0;
for (let i = 0; i < r.length; i += 500) {
  const teil = r.slice(i, i + 500).filter((z) => z.ort && z.ort.length >= 3 && z.ort.length <= 60);
  if (!teil.length) continue;
  const werte = sql.join(teil.map((z) => sql`(${z.ort}, ${z.n})`), sql`, `);
  await db.execute(sql`
    insert into ba_ortsliste (ort, bekannt) values ${werte}
    on conflict (ort) do update set bekannt = excluded.bekannt`);
  geschrieben += teil.length;
}
console.log(`${geschrieben.toLocaleString("de-DE")} Orte gespeichert`);
process.exit(0);
