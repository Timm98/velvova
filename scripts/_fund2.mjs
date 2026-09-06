import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { BundesagenturAdapter } = await import("../packages/jobs/src/sources/bundesagentur.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");
const { berufsabfragen } = await import("../packages/jobs/src/berufsabfragen.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const marke = new Date();
const alle = await berufsabfragen(400);
const r = await ingestFromAdapter(
  new BundesagenturAdapter({ abfragen: alle.slice(-45, -25), pauseMs: 100, gleichzeitig: 4 }),
  { limit: 300 },
);
console.log(`neu ${r.inserted} · zusammengeführt ${r.merged} · Fehler ${r.failed}`);

const p = (await db.execute(sql`
  select count(*)::int n,
         count(*) filter (where exists (select 1 from job_source_links l where l.job_id = j.id))::int mit
  from jobs j where j.fetched_at >= ${marke.toISOString()}`)).rows[0];
console.log(`In diesem Lauf angelegt: ${p.n} · davon mit Fundstelle: ${p.mit}`);
process.exit(0);
