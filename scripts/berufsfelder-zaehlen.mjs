import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Die offenen Stellen je Berufsfeld auszählen.
 *
 * Läuft im Pflegelauf, nicht im Seitenaufruf: Die Gruppierung über
 * 2,2 Mio. Zeilen dauert Minuten. Im Seitenaufruf gemessen: 120
 * Sekunden bis zum Abbruch, Stellenseite unbenutzbar.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
await db.execute(sql`set statement_timeout = '1800s'`);

for (const land of ["DE", "AT", "CH"]) {
  const t0 = Date.now();
  const r = (await db.execute(sql`
    select left(kldb, 2) g, count(*)::int n from jobs
    where country = ${land} and kldb is not null group by 1`)).rows;
  for (const z of r) {
    await db.execute(sql`
      insert into berufsfeld_bestand (land, gruppe, anzahl, berechnet_am)
      values (${land}, ${z.g}, ${z.n}, now())
      on conflict (land, gruppe) do update set anzahl = excluded.anzahl, berechnet_am = now()`);
  }
  console.log(`${land}: ${r.length} Berufsfelder in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
process.exit(0);
