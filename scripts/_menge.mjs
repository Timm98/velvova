import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select
    pg_size_pretty(sum(length(coalesce(description_tokens,''))))::text tokens,
    pg_size_pretty(sum(length(coalesce(core_tasks::text,''))))::text tasks,
    pg_size_pretty(sum(length(coalesce(benefits::text,''))))::text benefits,
    pg_size_pretty(sum(length(coalesce(title,'') || coalesce(location,'') || coalesce(original_url,''))))::text rest,
    count(*)::int n
  from (select * from jobs where is_demo=false limit 82654) x`)).rows[0];
console.log(r);
process.exit(0);
