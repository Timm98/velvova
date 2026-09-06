import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select count(*)::int gesamt, count(beruf)::int zugeordnet,
         count(distinct beruf)::int berufe from beruf_zuordnung`)).rows[0];
console.log(r);
process.exit(0);
