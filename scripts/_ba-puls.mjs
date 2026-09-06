import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select started_at, finished_at, fetched, created, updated, duration_ms
  from job_ingestion_runs where source_key = 'bundesagentur'
  order by started_at desc limit 6`)).rows;
for (const z of r) console.log(
  new Date(z.started_at).toLocaleTimeString("de-DE"),
  z.finished_at ? "fertig" : "läuft ",
  `geholt ${String(z.fetched).padStart(5)}`,
  `neu ${String(z.created).padStart(5)}`,
  z.duration_ms ? `${(z.duration_ms/1000).toFixed(0)}s` : "");
