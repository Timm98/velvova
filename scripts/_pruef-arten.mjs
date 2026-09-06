import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`select art, count(*)::int n from aufgabenproben group by 1 order by n desc`)).rows;
for (const z of r) console.log(z.art, z.n);
