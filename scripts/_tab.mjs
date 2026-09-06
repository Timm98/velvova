import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`select table_name from information_schema.tables where table_schema='public' and (table_name like '%raw%' or table_name like '%snapshot%' or table_name like '%ingest%') order by 1`)).rows;
console.log(r.map(x=>x.table_name).join("\n") || "keine");
process.exit(0);
