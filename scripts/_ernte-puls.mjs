import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select source_key, count(*)::int laeufe, sum(created)::int neu, sum(fetched)::int geholt,
         max(started_at) zuletzt
  from job_ingestion_runs
  where started_at > now() - interval '30 minutes'
  group by 1 order by zuletzt desc limit 10`)).rows;
if (!r.length) console.log("keine Läufe in den letzten 30 Minuten");
for (const z of r) console.log(String(z.source_key).padEnd(22), `${z.laeufe} Läufe`.padEnd(12),
  `neu ${z.neu ?? 0}`.padEnd(12), `geholt ${z.geholt ?? 0}`.padEnd(15),
  new Date(z.zuletzt).toLocaleTimeString("de-DE"));
