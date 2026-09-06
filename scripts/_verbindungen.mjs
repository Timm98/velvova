import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select state, count(*)::int n from pg_stat_activity group by 1 order by n desc`)).rows;
for (const z of r) console.log(String(z.state ?? "—").padEnd(24), z.n);
const [m] = (await db.execute(sql`show max_connections`)).rows;
console.log("max_connections:", m.max_connections);
