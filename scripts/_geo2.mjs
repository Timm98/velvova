import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const q = async (s) => (await db.execute(s)).rows ?? [];
const [g] = await q(sql`select count(*)::int as n,
  count(*) filter (where latitude is not null and longitude is not null)::int as mit_koord,
  count(distinct location)::int as orte from jobs`);
console.log(JSON.stringify(g));
const top = await q(sql`select location, count(*)::int as n from jobs group by 1 order by n desc limit 8`);
for (const r of top) console.log(`  ${String(r.n).padStart(4)}  ${r.location}`);
process.exit(0);
