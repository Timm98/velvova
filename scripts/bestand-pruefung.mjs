/**
 * Was wirklich in der Datenbank steht.
 *
 * Keine Zusammenfassung aus einem Bericht, sondern Abfragen. Jede Zahl
 * hier ist nachrechenbar, und jede Lücke ist eine echte Lücke.
 *
 *   node scripts/bestand-pruefung.mjs
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
const env = ladeEnvDatei();

const { getDb } = await import("../packages/db/src/index.ts");
const { loadRuntimeConfig } = await import("../packages/config/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");

const cfg = loadRuntimeConfig();
console.log(`Datenbank: ${cfg.db.driver === "pg" ? "Postgres (extern)" : "PGlite (lokale Datei)"}\n`);
if (cfg.db.driver !== "pg") {
  console.log("Abbruch: Diese Prüfung soll gegen die echte Datenbank laufen.");
  process.exit(1);
}

const db = await getDb();
const eins = async (q) => {
  const r = await db.execute(q);
  const rows = r.rows ?? r;
  return rows[0] ?? {};
};
const alle = async (q) => {
  const r = await db.execute(q);
  return r.rows ?? r;
};

console.log("══════ BESTAND ══════\n");

const g = await eins(sql`
  select
    count(*)::int                                                      as gesamt,
    count(distinct company_id)::int                                    as firmen,
    count(distinct lower(title))::int                                  as titel,
    count(*) filter (where original_url is not null)::int              as mit_link,
    count(*) filter (where original_url is null)::int                  as ohne_link,
    count(*) filter (where length(coalesce(description,'')) > 40)::int as mit_text,
    count(*) filter (where length(coalesce(description,'')) <= 40)::int as ohne_text,
    count(*) filter (where coalesce(location,'') <> '')::int           as mit_ort,
    count(*) filter (where published_at is not null)::int              as mit_datum,
    count(*) filter (where salary_disclosed)::int                      as mit_gehalt,
    count(*) filter (where salary_min is not null or salary_max is not null)::int as mit_betrag,
    count(*) filter (where work_model <> 'on_site')::int               as remote_hybrid,
    count(*) filter (where is_demo)::int                               as demo,
    count(*) filter (where expires_at is not null and expires_at < now())::int as abgelaufen
  from jobs
`);

const zeile = (k, v) => console.log(`  ${k.padEnd(34)} ${String(v).padStart(6)}`);
zeile("Stellen gesamt", g.gesamt);
zeile("eindeutige Unternehmen", g.firmen);
zeile("eindeutige Jobtitel", g.titel);
zeile("mit Original-Link", g.mit_link);
zeile("ohne Original-Link", g.ohne_link);
zeile("mit Beschreibung", g.mit_text);
zeile("ohne Beschreibung", g.ohne_text);
zeile("mit Standort", g.mit_ort);
zeile("mit publishedAt", g.mit_datum);
zeile("mit Gehalt (disclosed)", g.mit_gehalt);
zeile("mit Betrag (min oder max)", g.mit_betrag);
zeile("Remote oder Hybrid", g.remote_hybrid);
zeile("als Demo markiert", g.demo);
zeile("abgelaufen", g.abgelaufen);

console.log("\n══════ JE QUELLE ══════\n");
for (const z of await alle(sql`
  select s.display_name as q, count(*)::int as n,
         count(*) filter (where j.salary_disclosed)::int as gehalt,
         count(*) filter (where j.original_url is not null)::int as link,
         max(j.fetched_at) as zuletzt
  from jobs j join job_sources s on s.id = j.source_id
  group by 1 order by 2 desc
`)) {
  console.log(`  ${String(z.q).padEnd(22)} ${String(z.n).padStart(5)} Stellen · ${z.gehalt} mit Gehalt · ${z.link} mit Link`);
}

console.log("\n══════ MÖGLICHE DUBLETTEN ══════\n");
const d1 = await eins(sql`
  select count(*)::int as n from (
    select content_hash from jobs group by content_hash having count(*) > 1
  ) t
`);
const d2 = await alle(sql`
  select lower(j.title) as t, c.name as f, lower(split_part(j.location, ',', 1)) as o, count(*)::int as n
  from jobs j join companies c on c.id = j.company_id
  group by 1,2,3 having count(*) > 1
  order by 4 desc limit 8
`);
console.log(`  gleicher Inhaltshash: ${d1.n} Gruppen`);
console.log(`  gleicher Titel+Firma+Ort: ${d2.length} Gruppen (Top ${Math.min(8, d2.length)}):`);
for (const z of d2) console.log(`      ${z.n}× ${String(z.t).slice(0, 44).padEnd(44)} ${String(z.f).slice(0, 24)}`);

console.log("\n══════ STICHPROBE (20) ══════\n");
for (const z of await alle(sql`
  select j.title, c.name as firma, j.location, j.original_url, s.display_name as quelle,
         length(coalesce(j.description,'')) as textlaenge, j.is_demo, j.published_at
  from jobs j join companies c on c.id = j.company_id join job_sources s on s.id = j.source_id
  order by random() limit 20
`)) {
  const url = z.original_url ? new URL(z.original_url).hostname : "KEIN LINK";
  console.log(`  [${String(z.quelle).slice(0,9).padEnd(9)}] ${String(z.title).slice(0, 44).padEnd(44)} | ${String(z.firma).slice(0, 20).padEnd(20)} | ${String(z.location).slice(0, 18).padEnd(18)} | ${String(z.textlaenge).padStart(5)}z | ${url}${z.is_demo ? " | DEMO!" : ""}`);
}

process.exit(0);
