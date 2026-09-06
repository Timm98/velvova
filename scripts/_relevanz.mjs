import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Wie viel von einem gesuchten Beruf steckt in den neuesten 2.000?
 *
 * Die Kandidatenauswahl nimmt die neuesten Stellen, die die harten
 * Bedingungen nicht verletzen. Das ist speichersparend und sagt nichts
 * über Relevanz: Wer Zerspanungsmechaniker sucht, findet sie nur, wenn
 * sie zufällig frisch eingestellt wurden.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

for (const beruf of ["Zerspanungsmechaniker", "Erzieher", "Steuerberater", "Data Engineer", "Pflegefachkraft"]) {
  const r = (await db.execute(sql`
    with kandidaten as (
      select id, title from jobs where is_demo = false
      order by coalesce(published_at, fetched_at) desc limit 2000
    )
    select
      (select count(*)::int from jobs where is_demo = false and title ilike ${'%' + beruf + '%'}) gesamt,
      (select count(*)::int from kandidaten where title ilike ${'%' + beruf + '%'}) in_auswahl`)).rows[0];
  const anteil = r.gesamt > 0 ? (100 * r.in_auswahl / r.gesamt).toFixed(1) : "—";
  console.log(`  ${beruf.padEnd(24)} ${String(r.gesamt).padStart(6)} im Bestand · ${String(r.in_auswahl).padStart(4)} in der Auswahl · ${anteil} %`);
}
process.exit(0);
