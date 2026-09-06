import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb, schema } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [mit] = await db.select({ id: schema.jobs.id, t: schema.jobs.title }).from(schema.jobs).where(sql`salary_disclosed = true and salary_min is not null`).limit(1);
const [ohne] = await db.select({ id: schema.jobs.id, t: schema.jobs.title }).from(schema.jobs).where(sql`salary_disclosed = false`).limit(1);
console.log(JSON.stringify({ mit: mit?.id, mitTitel: mit?.t, ohne: ohne?.id, ohneTitel: ohne?.t }));
process.exit(0);
