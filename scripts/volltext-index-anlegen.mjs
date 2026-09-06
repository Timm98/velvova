import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Den Volltextindex auf `title` ohne Sperre anlegen.
 *
 * Gleicher Grund wie bei scripts/index-anlegen.mjs: `create index`
 * sperrt die Tabelle für Schreibzugriffe, und nebenher laufen Importe.
 * `concurrently` läuft nicht in einer Transaktion und gehört deshalb
 * hierher und nicht in den Migrationsläufer.
 *
 * Aufruf: node --experimental-strip-types scripts/volltext-index-anlegen.mjs
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
await db.execute(sql`set statement_timeout = '7200s'`);
console.time("Volltextindex");
await db.execute(sql`
  create index concurrently if not exists jobs_volltext_idx
    on jobs using gin (to_tsvector('german', title))
    where is_demo = false
`);
console.timeEnd("Volltextindex");

const [g] = (await db.execute(sql`
  select pg_size_pretty(pg_relation_size('jobs_volltext_idx')) groesse`)).rows;
console.log("Groesse:", g.groesse);
process.exit(0);
