import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select count(*)::int gesamt, count(distinct lower(btrim(title)))::int distinkt,
         count(*) filter (where salary_min is not null or salary_max is not null)::int mitGehalt
  from jobs`)).rows[0];
console.log(r);
const top = (await db.execute(sql`
  select lower(btrim(title)) t, count(*)::int n from jobs group by 1 order by 2 desc limit 8`)).rows;
console.log(top.map(x => `${x.n}× ${x.t}`).join("\n"));
process.exit(0);
