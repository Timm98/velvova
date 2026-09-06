import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
await db.execute(sql`set statement_timeout = '7200s'`);
console.time("Datumsindex");
await db.execute(sql`
  create index concurrently if not exists jobs_neueste_idx
    on jobs (published_at desc nulls last) where is_demo = false`);
console.timeEnd("Datumsindex");
process.exit(0);
