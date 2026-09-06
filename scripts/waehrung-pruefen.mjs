/**
 * Welche Währung steht an welcher Stelle — und passt sie zum Ort?
 *
 * Der Screenshot zeigte einen Job in Frankfurt mit 60.000–80.000 GBP.
 * Diese Abfrage sagt, ob das ein Einzelfall ist oder ein Muster.
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb, schema } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");

const db = await getDb();
const nachWaehrung = await db
  .select({ w: schema.jobs.salaryCurrency, n: sql`count(*)::int` })
  .from(schema.jobs)
  
  .groupBy(schema.jobs.salaryCurrency)
  .orderBy(sql`count(*) desc`);
console.log("  Währungen im Bestand:");
for (const r of nachWaehrung) console.log(`    ${String(r.w).padEnd(8)} ${r.n}`);

const verdacht = await db
  .select({
    titel: schema.jobs.title, ort: schema.jobs.location, land: schema.jobs.country,
    w: schema.jobs.salaryCurrency, min: schema.jobs.salaryMin, max: schema.jobs.salaryMax,
    offen: schema.jobs.salaryDisclosed,
  })
  .from(schema.jobs)
  .where(sql`salary_currency <> 'EUR' or (salary_min is not null and country <> 'DE')`)
  .limit(12);
console.log(`\n  Stellen mit Nicht-EUR-Währung (${verdacht.length} gezeigt):`);
for (const r of verdacht) {
  console.log(`    ${String(r.w)}  ${String(r.min ?? "–")}–${String(r.max ?? "–")}  ${String(r.ort ?? "?").slice(0,26).padEnd(26)} ${String(r.land ?? "?").padEnd(4)} ${r.offen ? 'angegeben' : 'nicht angegeben'}`);
}
process.exit(0);
