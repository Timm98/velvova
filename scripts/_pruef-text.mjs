import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select p.art, d.richtig is null as ohne_bewertung, count(*)::int n
  from probendurchlaeufe d join aufgabenproben p on p.id = d.probe_id
  group by 1,2 order by n desc`)).rows;
for (const z of r) console.log(z.art, "| ohne Bewertung:", z.ohne_bewertung, "|", z.n);
