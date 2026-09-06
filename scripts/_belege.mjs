import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select source_type, count(*)::int n from evidence_items group by 1 order by n desc`)).rows;
for (const x of r) console.log(`  ${String(x.source_type).padEnd(20)} ${x.n}`);
process.exit(0);
