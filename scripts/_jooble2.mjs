import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select started_at, fetched, created, error_summary
  from job_ingestion_runs where source_key like 'jooble%'
  order by started_at desc limit 3`)).rows;
if (!r.length) console.log("nie gelaufen");
for (const z of r) console.log(new Date(z.started_at).toLocaleString("de-DE"),
  `geholt ${z.fetched} neu ${z.created}`, z.error_summary ? `· ${String(z.error_summary).slice(0, 90)}` : "");
const [q] = (await db.execute(sql`select id from job_sources where key = 'jooble_de'`)).rows;
const [n] = (await db.execute(sql`select count(*)::int n from job_source_links where source_id = ${q.id}::uuid`)).rows;
console.log("Stellen aus Jooble im Bestand:", n.n);
