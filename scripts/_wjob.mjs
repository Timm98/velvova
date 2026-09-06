import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb, schema } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const rows = await db
  .select({ id: schema.jobs.id, t: schema.jobs.title, min: schema.jobs.salaryMin, max: schema.jobs.salaryMax, c: schema.jobs.salaryCurrency, p: schema.jobs.salaryPeriod, land: schema.jobs.country })
  .from(schema.jobs)
  .where(sql`salary_min is not null and salary_period = 'year' and salary_currency = 'EUR' and country = 'DE' and salary_min between 30000 and 120000`)
  .limit(3);
console.log(JSON.stringify(rows));
process.exit(0);
