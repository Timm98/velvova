import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { spracheErkennen } = await import("../packages/domain/src/sprache.ts");
const db = await getDb();

/**
 * Die Erkennung gegen echte Anzeigen halten.
 *
 * Erst an klar englischen, dann an einer Zufallsstichprobe deutscher
 * Stellen — dort muss sie fast immer „de" sagen.
 */
const englisch = (await db.execute(sql`
  select title, description from jobs tablesample system (3)
  where country='DE' and (description ilike '%your responsibilities%'
     or description ilike '%what you bring%' or description ilike '%we offer%')
  limit 12`)).rows;
let richtig = 0;
for (const z of englisch) {
  const r = spracheErkennen(z.description);
  if (r.sprache === "en") richtig++;
  else console.log(`  ? ${String(z.title).slice(0,40)} → ${r.sprache} (de ${r.deutsch} / en ${r.englisch})`);
}
console.log(`klar englische Anzeigen: ${richtig} von ${englisch.length} als „en" erkannt`);

const zufall = (await db.execute(sql`
  select description from jobs tablesample system (1)
  where country='DE' and length(description) > 400 limit 200`)).rows;
const zaehler = { de: 0, en: 0, unbekannt: 0 };
for (const z of zufall) zaehler[spracheErkennen(z.description).sprache]++;
console.log(`\nZufallsstichprobe ${zufall.length} deutsche Stellen:`);
for (const [k, v] of Object.entries(zaehler)) console.log(`  ${k.padEnd(10)} ${v} (${(100*v/zufall.length).toFixed(1)} %)`);
