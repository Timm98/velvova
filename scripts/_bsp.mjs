import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const mit = (await db.execute(sql`select id from jobs where jsonb_array_length(benefits) >= 4 limit 1`)).rows[0];
const ohne = (await db.execute(sql`select id from jobs where jsonb_array_length(benefits) = 0 limit 1`)).rows[0];
console.log(`${mit.id} ${ohne.id}`);
process.exit(0);
