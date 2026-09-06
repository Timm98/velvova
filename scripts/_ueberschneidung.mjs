import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Wie stark überschneiden sich unsere Quellen wirklich?
 *
 * Entscheidend für die Frage „wie viele Stellen sind maximal
 * erreichbar": Zwei Quellen mit je einer Million sind zusammen nicht
 * zwei Millionen, wenn sie dieselben Anzeigen führen.
 *
 * Gemessen am eigenen Bestand über den kanonischen Schlüssel — Titel,
 * Arbeitgeber, Ort — also genau so, wie auch die Entdopplung urteilt.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const paare = (await db.execute(sql`
  select a.q as quelle_a, b.q as quelle_b, count(*)::int gemeinsam
  from (
    select distinct s.display_name q, lower(btrim(j.title)) t, c.name f, lower(btrim(j.location)) o
    from jobs j join job_sources s on s.id = j.source_id join companies c on c.id = j.company_id
    where j.is_demo = false
  ) a
  join (
    select distinct s.display_name q, lower(btrim(j.title)) t, c.name f, lower(btrim(j.location)) o
    from jobs j join job_sources s on s.id = j.source_id join companies c on c.id = j.company_id
    where j.is_demo = false
  ) b on a.t = b.t and a.f = b.f and a.o = b.o and a.q < b.q
  group by 1,2 order by 3 desc limit 8`)).rows;

const jeQuelle = new Map((await db.execute(sql`
  select s.display_name q, count(*)::int n from jobs j
  join job_sources s on s.id = j.source_id where j.is_demo = false group by 1`)).rows.map(r => [r.q, r.n]));

console.log("Gemeinsame Stellen zwischen zwei Quellen (gleicher Titel, Arbeitgeber, Ort):\n");
if (paare.length === 0) console.log("  keine");
for (const p of paare) {
  const kleiner = Math.min(jeQuelle.get(p.quelle_a) ?? 0, jeQuelle.get(p.quelle_b) ?? 0);
  console.log(`  ${p.gemeinsam.toString().padStart(5)}  ${p.quelle_a} ∩ ${p.quelle_b}  (${kleiner ? (100*p.gemeinsam/kleiner).toFixed(1) : 0} % der kleineren)`);
}

const g = (await db.execute(sql`
  select count(*)::int zeilen,
         count(distinct (lower(btrim(title)), company_id, lower(btrim(location))))::int verschieden
  from jobs where is_demo = false`)).rows[0];
console.log(`\nZeilen: ${g.zeilen} · verschiedene Stellen: ${g.verschieden} · Dubletten: ${g.zeilen - g.verschieden}`);
process.exit(0);
