/**
 * Was liefert jeder Anbieter wirklich? (§60, §61)
 *
 * Die Frage, die vor jeder Ranking-Diskussion steht. „1.447 Stellen"
 * sagt nichts darüber, ob man mit ihnen arbeiten kann. Ein Anbieter,
 * der tausend Anzeigen ohne Beschreibung liefert, ist keine Quelle —
 * er ist Ballast, der die Liste füllt.
 *
 *   node scripts/quellen-zeugnis.mjs
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb, schema } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");

const db = await getDb();
const zeilen = await db.execute(sql`
  SELECT
    s.display_name                                            AS quelle,
    count(*)::int                                             AS gesamt,
    count(*) FILTER (WHERE length(coalesce(j.description,'')) > 200)::int AS beschreibung,
    count(*) FILTER (WHERE j.salary_disclosed)::int           AS gehalt,
    count(*) FILTER (WHERE j.salary_min IS NOT NULL)::int      AS gehaltszahl,
    count(*) FILTER (WHERE j.work_model IS NOT NULL)::int      AS modell,
    count(*) FILTER (WHERE j.original_url IS NOT NULL)::int    AS link,
    count(*) FILTER (WHERE j.published_at > now() - interval '14 days')::int AS frisch
  FROM jobs j
  JOIN job_sources s ON s.id = j.source_id
  GROUP BY s.display_name
  ORDER BY count(*) DESC
`);

const r = zeilen.rows ?? zeilen;
const p = (n, g) => (g === 0 ? "  – " : `${Math.round((n / g) * 100)}%`.padStart(4));
console.log(`  ${"Quelle".padEnd(26)} ${"Jobs".padStart(6)} ${"Beschr".padStart(7)} ${"Gehalt".padStart(7)} ${"Modell".padStart(7)} ${"Link".padStart(6)} ${"frisch".padStart(7)}`);
console.log(`  ${"-".repeat(26)} ${"-".repeat(6)} ${"-".repeat(7)} ${"-".repeat(7)} ${"-".repeat(7)} ${"-".repeat(6)} ${"-".repeat(7)}`);
let g = 0, b = 0, ge = 0, m = 0;
for (const z of r) {
  console.log(`  ${String(z.quelle).slice(0,26).padEnd(26)} ${String(z.gesamt).padStart(6)} ${p(z.beschreibung, z.gesamt).padStart(7)} ${p(z.gehalt, z.gesamt).padStart(7)} ${p(z.modell, z.gesamt).padStart(7)} ${p(z.link, z.gesamt).padStart(6)} ${p(z.frisch, z.gesamt).padStart(7)}`);
  g += z.gesamt; b += z.beschreibung; ge += z.gehalt; m += z.modell;
}
console.log(`\n  Gesamt: ${g} Stellen · Beschreibung ${Math.round(b/g*100)} % · Gehalt ${Math.round(ge/g*100)} % · Arbeitsmodell ${Math.round(m/g*100)} %`);
process.exit(0);
