import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Reed, USAJOBS und Findwork importieren.
 *
 * Getrennt vom Hauptlauf, weil diese drei ohne Suchbegriffe blättern:
 * Der deutsche Berufswortschatz taugt für britische und amerikanische
 * Stellen nicht, und ein falscher Begriff ist schlechter als keiner.
 *
 * In Abschnitten, damit früh und oft geschrieben wird — ein Abbruch
 * kostet dann nur den laufenden Abschnitt.
 */
const { ReedAdapter } = await import("../packages/jobs/src/sources/reed.ts");
const { UsaJobsAdapter } = await import("../packages/jobs/src/sources/usajobs.ts");
const { FindworkAdapter } = await import("../packages/jobs/src/sources/findwork.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");
const { englischeAbfragen } = await import("../packages/jobs/src/berufsabfragen.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const ziel = Number(process.argv[2] ?? 20000);

/*
 * Englische Suchbegriffe, geerntet aus den Titeln dieser Quellen.
 *
 * Ohne sie blättern alle drei nur durch die ersten Seiten und
 * wiederholen sich dann — gemessen: USAJOBS 1.755 neue Stellen, dann
 * nichts mehr.
 */
const begriffe = await englischeAbfragen(Number(process.argv[3] ?? 800));
console.log(`Suchwortschatz: ${begriffe.length} englische Begriffe`);
const vorher = (await db.execute(sql`select count(*)::int n from jobs where is_demo=false`)).rows[0].n;
console.log(`Bestand vorher: ${vorher}\n`);

for (const [name, bauen] of [
  ["USAJOBS", (t) => new UsaJobsAdapter({ abfragen: t })],
  ["Reed", (t) => new ReedAdapter({ abfragen: t })],
  ["Findwork", (t) => new FindworkAdapter({ abfragen: t })],
]) {
  const t0 = Date.now();
  let geholt = 0, neu = 0, fehler = 0;
  try {
    /* Je Abschnitt eine eigene Gruppe von Begriffen. */
    const GRUPPE = 25;
    for (let i = 0; i * GRUPPE < begriffe.length && geholt < ziel; i++) {
      const teil = begriffe.slice(i * GRUPPE, (i + 1) * GRUPPE);
      if (teil.length === 0) break;
      const r = await ingestFromAdapter(bauen(teil), { limit: Math.min(2000, ziel - geholt) });
      geholt += r.fetched;
      neu += r.inserted;
      fehler += r.failed;
      if (r.fetched === 0) break;
    }
  } catch (e) {
    console.log(`  ! ${name}: ${String(e instanceof Error ? e.message : e).slice(0, 120)}`);
  }
  console.log(
    `  ${name.padEnd(10)} geholt ${String(geholt).padStart(6)} · neu ${String(neu).padStart(6)} · ` +
      `fehlerhaft ${fehler} · ${((Date.now() - t0) / 60000).toFixed(1)} min`,
  );
}

const nach = (await db.execute(sql`select count(*)::int n from jobs where is_demo=false`)).rows[0].n;
console.log(`\nBestand: ${vorher} → ${nach} (+${nach - vorher}).`);
process.exit(0);
