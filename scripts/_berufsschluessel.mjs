import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const sp = (await db.execute(sql`
  select column_name, data_type from information_schema.columns
  where table_name = 'beruf_schluessel' order by ordinal_position`)).rows;
console.log("beruf_schluessel:", sp.map(z => z.column_name).join(", "));
const r = (await db.execute(sql`select * from beruf_schluessel limit 3`)).rows;
for (const z of r) console.log("  ", JSON.stringify(z).slice(0, 190));
const [n] = (await db.execute(sql`select count(*)::int n from beruf_schluessel`)).rows;
console.log(`\n${n.n} Einträge`);
