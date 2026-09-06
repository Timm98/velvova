import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select salary_period, count(*)::int n from jobs
  where salary_min is not null or salary_max is not null group by 1 order by 2 desc`)).rows;
console.log(r.map(x => `${x.salary_period}=${x.n}`).join("  "));
process.exit(0);
