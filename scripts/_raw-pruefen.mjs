import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  select count(*)::int n,
         count(*) filter (where raw_payload ? 'hauptberuf')::int mit_hauptberuf
  from job_snapshots`)).rows[0];
console.log(`  job_snapshots: ${Number(r.n).toLocaleString("de-DE")} · mit hauptberuf: ${Number(r.mit_hauptberuf).toLocaleString("de-DE")}`);
const b = (await db.execute(sql`
  select raw_payload->>'hauptberuf' as beruf, count(*)::int n from job_snapshots
  where raw_payload ? 'hauptberuf' group by 1 order by n desc limit 5`)).rows;
for (const x of b) console.log(`    ${String(x.beruf).slice(0,44).padEnd(46)} ${x.n}`);
process.exit(0);
