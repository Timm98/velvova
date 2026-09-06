import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { spracheErkennen } = await import("../packages/domain/src/sprache.ts");
const db = await getDb();

/**
 * Sind die als „en" erkannten deutschen Stellen wirklich englisch?
 *
 * Ein falsches „en" ist teurer als ein falsches „unbekannt": Es
 * schickt eine deutsche Anzeige durch die Übersetzung und macht sie
 * schlechter.
 */
const zufall = (await db.execute(sql`
  select title, description from jobs tablesample system (2)
  where country='DE' and length(description) > 400 limit 400`)).rows;

const treffer = [];
for (const z of zufall) {
  const r = spracheErkennen(z.description);
  if (r.sprache === "en") treffer.push({ ...z, r });
}
console.log(`${treffer.length} von ${zufall.length} als „en" erkannt\n`);
for (const t of treffer.slice(0, 6)) {
  console.log(`„${String(t.title).slice(0, 46)}"  (de ${t.r.deutsch} / en ${t.r.englisch})`);
  console.log(`   ${String(t.description).replace(/\s+/g, " ").slice(0, 150)}`);
}
