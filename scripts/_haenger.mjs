import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select pid, state, wait_event_type, wait_event,
         round(extract(epoch from (now()-query_start)))::int sek,
         left(regexp_replace(query, '\s+', ' ', 'g'), 90) q
  from pg_stat_activity
  where state <> 'idle' and pid <> pg_backend_pid()
  order by query_start`)).rows;
for (const x of r) console.log(`pid ${x.pid} ${String(x.state).padEnd(8)} ${String(x.sek).padStart(6)}s  ${x.wait_event_type ?? "-"}/${x.wait_event ?? "-"}  ${x.q}`);
console.log(`\n${r.length} aktive Abfragen`);
process.exit(0);
