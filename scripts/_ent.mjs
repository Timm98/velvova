import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
for (const r of (await db.execute(sql`select * from beruf_entgelt order by beruf`)).rows)
  console.log(`${String(r.beruf).padEnd(24)} ${String(r.q1).padStart(7)} | ${String(r.median).padStart(7)} | ${String(r.q3).padStart(7)}  (n=${r.anzahl}, ${r.quelle})`);
process.exit(0);
