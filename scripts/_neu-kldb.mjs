import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select count(*)::int n, count(kldb)::int mit
  from jobs where is_demo=false and fetched_at > now() - interval '5 minutes'`)).rows[0];
console.log(`  in den letzten 5 Minuten: ${r.n} Stellen · ${r.mit} mit Kennung`);
process.exit(0);
