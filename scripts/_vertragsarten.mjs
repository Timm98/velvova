import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select coalesce(contract_type::text, '— nicht gesetzt —') as art, count(*)::int as n
  from jobs where is_demo = false group by 1 order by n desc`)).rows;
for (const x of r) console.log(String(x.art).padEnd(24), Number(x.n).toLocaleString("de-DE").padStart(10));
process.exit(0);
