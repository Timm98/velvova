import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb, schema } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [{ n }] = await db.execute(sql`select count(*)::int as n from jobs where weekly_hours is not null`).then(r => r.rows ?? r);
const rows = await db.execute(sql`select id, title, weekly_hours, salary_min, salary_max from jobs where weekly_hours is not null and salary_min is not null and salary_period='year' and salary_currency='EUR' and country='DE' limit 3`).then(r => r.rows ?? r);
console.log(JSON.stringify({ mitStunden: n, beispiele: rows }));
process.exit(0);
