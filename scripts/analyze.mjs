import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die Planerstatistik auffrischen.
 *
 * ── Warum das nötig ist ───────────────────────────────────────
 *
 * Bei laufendem Import wachsen die grossen Tabellen um Zehntausende
 * Zeilen je Stunde. Der Abfrageplaner rechnet währenddessen mit
 * Zahlen von vorher und wählt Pläne, die für einen kleineren Bestand
 * richtig gewesen wären.
 *
 * Gemessen: Dieselbe Zählung dauerte 12 und wenig später 44 Sekunden,
 * obwohl inzwischen ein passender Index dazugekommen war.
 *
 * `analyze` liest eine Stichprobe und ist billig — Minuten, keine
 * Sperre.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
await db.execute(sql`set statement_timeout = '1800s'`);
for (const t of ["jobs", "job_source_links", "job_snapshots", "companies"]) {
  const t0 = Date.now();
  await db.execute(sql.raw(`analyze ${t}`));
  console.log(`${t.padEnd(20)} ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
process.exit(0);
