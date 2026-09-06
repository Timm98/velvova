import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { vergleichswert, alsSpanne } = await import("../apps/web/src/lib/jobs/gehaltsvergleich.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const rows = (await db.execute(sql`
  select title, core_tasks, salary_min from jobs limit 2600`)).rows;
let mit = 0, ohneGehalt = 0, mitVergleich = 0;
const beispiele = [];
for (const r of rows) {
  const v = await vergleichswert(r.title, Array.isArray(r.core_tasks) ? r.core_tasks : []);
  if (v) mit++;
  if (r.salary_min === null) {
    ohneGehalt++;
    if (v) { mitVergleich++; if (beispiele.length < 6) beispiele.push(`  ${alsSpanne(v)}  (n=${v.anzahl}, ${v.gruppe})  „${r.title.slice(0,42)}"`); }
  }
}
console.log(`Stellen: ${rows.length}`);
console.log(`  mit Vergleichswert:            ${mit} (${((mit/rows.length)*100).toFixed(1)} %)`);
console.log(`  ohne eigene Gehaltsangabe:     ${ohneGehalt}`);
console.log(`  davon mit Vergleichswert:      ${mitVergleich} (${((mitVergleich/ohneGehalt)*100).toFixed(1)} %)\n`);
console.log(beispiele.join("\n"));
process.exit(0);
