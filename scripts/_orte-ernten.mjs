import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
console.time("gruppieren");
const r = (await db.execute(sql`
  select split_part(location, ',', 1) ort, count(*)::int n
  from jobs tablesample system (12)
  where country = 'DE' and location is not null and location <> ''
  group by 1 having count(*) >= 2
  order by n asc limit 20`)).rows;
console.timeEnd("gruppieren");
console.log("kleinste zuerst:", r.slice(0, 8).map(z => `${z.ort}(${z.n})`).join(", "));
const [a] = (await db.execute(sql`
  select count(*)::int n from (
    select split_part(location, ',', 1) ort from jobs tablesample system (12)
    where country='DE' and location is not null group by 1) x`)).rows;
console.log("verschiedene Orte in der 12 %-Stichprobe:", a.n);
