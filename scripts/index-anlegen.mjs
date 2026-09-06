import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Den Landindex ohne Sperre anlegen.
 *
 * ── Warum nicht über die Migration ────────────────────────────
 *
 * `create index` sperrt die Tabelle für Schreibzugriffe. Auf 1,7 Mio.
 * Zeilen dauert das Minuten, und währenddessen stehen alle laufenden
 * Importe. `concurrently` verzichtet auf die Sperre und braucht dafür
 * zwei Durchläufe — das ist der bessere Handel, wenn nebenher geerntet
 * wird.
 *
 * Es läuft nicht in einer Transaktion; deshalb hier und nicht im
 * Migrationsläufer.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
await db.execute(sql`set statement_timeout = '3600s'`);
console.time("Index");
await db.execute(sql`
  create index concurrently if not exists jobs_country_published_idx
    on jobs (country, published_at desc)
    where is_demo = false`);
console.timeEnd("Index");
const r = (await db.execute(sql`
  select indexname from pg_indexes where tablename='jobs' and indexname='jobs_country_published_idx'`)).rows;
console.log(r.length ? "angelegt" : "NICHT angelegt");
process.exit(0);
