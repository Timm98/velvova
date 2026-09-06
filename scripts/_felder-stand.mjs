import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select land, count(*)::int n, sum(anzahl)::int stellen from berufsfeld_bestand group by 1 order by 1`)).rows;
for (const z of r) console.log(`${z.land}: ${z.n} Felder · ${Number(z.stellen).toLocaleString("de-DE")} Stellen`);
