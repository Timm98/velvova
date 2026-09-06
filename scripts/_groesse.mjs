import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select
    pg_size_pretty(sum(length(coalesce(description_tokens,''))))  as tokens,
    pg_size_pretty(sum(length(coalesce(description,''))))         as text,
    pg_size_pretty(sum(length(coalesce(benefits::text,''))))      as benefits,
    pg_size_pretty(sum(length(coalesce(core_tasks::text,''))))    as tasks,
    count(*)::int n
  from jobs where is_demo = false`)).rows[0];
console.log(r);
process.exit(0);
