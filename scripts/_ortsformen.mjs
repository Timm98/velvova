import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select location, count(*)::int n from jobs where is_demo=false and location ilike '%Berlin%'
  group by location order by n desc limit 15`)).rows;
for (const x of r) console.log(`${String(x.n).padStart(7)}  ${x.location}`);
process.exit(0);
