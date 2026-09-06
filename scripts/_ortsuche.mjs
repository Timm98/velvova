import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const e = (await db.execute(sql`select extname from pg_extension`)).rows.map(r=>r.extname);
console.log("Erweiterungen:", e.join(", "));
const v = (await db.execute(sql`select name from pg_available_extensions where name='pg_trgm'`)).rows;
console.log("pg_trgm verfuegbar:", v.length > 0);
const t0 = Date.now();
const r = (await db.execute(sql`
  select count(*)::int n from jobs where is_demo=false and location ilike ${'Berlin%'}`)).rows;
console.log(`Ortssuche ohne Index: ${Date.now()-t0} ms · ${r[0].n.toLocaleString("de")} Treffer`);
process.exit(0);
