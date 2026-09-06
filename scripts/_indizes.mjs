import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`select indexname, indexdef from pg_indexes where tablename='jobs' order by indexname`)).rows;
for (const x of r) console.log(`${x.indexname}\n    ${x.indexdef.replace(/^CREATE.*USING /,'').slice(0,110)}`);
process.exit(0);
