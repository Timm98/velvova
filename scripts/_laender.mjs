import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
for (const r of (await db.execute(sql`
  select country, count(*)::int n from jobs where is_demo = false group by 1 order by 2 desc`)).rows)
  console.log(`  ${r.country ?? "?"}  ${String(r.n).padStart(6)}`);
console.log("\nStellen gesamt:", (await db.execute(sql`select count(*)::int n from jobs where is_demo=false`)).rows[0].n);
process.exit(0);
