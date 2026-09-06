import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select country, count(*)::int n from jobs where is_demo=false and country is not null
  group by country order by n desc`)).rows;
console.log(`Länder im Bestand: ${r.length}`);
console.log(r.map(x=>`${x.country} ${x.n.toLocaleString("de")}`).join(" · "));
process.exit(0);
