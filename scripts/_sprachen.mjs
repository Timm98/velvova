import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [a] = (await db.execute(sql`
  select count(*)::int n,
    count(*) filter (where description ilike '% the %' and description ilike '% and %')::int englisch,
    count(*) filter (where description ilike '%your responsibilities%' or description ilike '%what you bring%'
                        or description ilike '%we offer%')::int klar_englisch
  from jobs tablesample system (2) where country='DE' and description is not null`)).rows;
console.log(`deutsche Stellen, Stichprobe ${a.n.toLocaleString("de-DE")}`);
console.log(`  „ the " und „ and ":        ${a.englisch} (${(100*a.englisch/a.n).toFixed(1)} %)`);
console.log(`  klar englische Wendungen:  ${a.klar_englisch} (${(100*a.klar_englisch/a.n).toFixed(1)} %)`);
