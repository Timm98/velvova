import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const [a] = (await db.execute(sql`
  select count(*)::int gesamt,
         count(*) filter (where zuletzt_geerntet is not null)::int fertig,
         coalesce(sum(ertrag), 0)::int ertrag,
         count(*) filter (where bekannt between 5 and 4000)::int in_reichweite
  from ba_ortsliste`)).rows;
console.log(`Orte ${a.gesamt.toLocaleString("de-DE")} · in Reichweite ${a.in_reichweite.toLocaleString("de-DE")} · abgearbeitet ${a.fertig} · daraus neu ${a.ertrag}`);
