import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const q = async (s) => (await db.execute(s)).rows ?? [];
const [g] = await q(sql`select count(*)::int as gesamt,
  count(*) filter (where jsonb_array_length(benefits) > 0)::int as mit_benefits,
  count(*) filter (where weekly_hours is not null)::int as mit_stunden,
  count(*) filter (where salary_min is not null)::int as mit_gehalt
  from jobs`);
console.log("GESAMT " + JSON.stringify(g));
const top = await q(sql`select b as text, count(*)::int as n
  from jobs, jsonb_array_elements_text(benefits) b group by b order by n desc limit 30`);
console.log("TOP " + JSON.stringify(top));
process.exit(0);
