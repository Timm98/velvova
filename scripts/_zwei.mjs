import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`select id from jobs where salary_min is not null and salary_period='year' and weekly_hours is not null and jsonb_array_length(benefits) > 0 limit 2`)).rows;
console.log(r.map((x) => x.id).join(" "));
process.exit(0);
