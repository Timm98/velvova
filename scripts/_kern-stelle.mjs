import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select id, title, location, country from jobs
  where salary_min is not null and salary_period = 'year' and country = 'DE'
    and location is not null and location <> '' and location !~* '^(deutschland|germany)$'
  limit 5`)).rows;
for (const x of r) console.log(`  ${String(x.location).padEnd(40)} ${String(x.title).slice(0, 44)}`);
process.exit(0);
