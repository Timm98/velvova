import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const [v] = (await db.execute(sql`
  select
    count(*)::int n,
    count(*) filter (where published_at < now() - interval '90 days')::int ab90,
    count(*) filter (where published_at < now() - interval '180 days')::int ab180,
    count(*) filter (where published_at < now() - interval '365 days')::int ab365,
    count(*) filter (where fetched_at > now() - interval '7 days')::int frisch_geholt
  from jobs tablesample system (5)
  where published_at is not null`)).rows;
const p = (x) => `${((x / v.n) * 100).toFixed(1)} %`;
console.log(`Stichprobe ${v.n.toLocaleString("de-DE")} Stellen`);
console.log(`  älter als  90 Tage: ${String(v.ab90).padStart(6)}  ${p(v.ab90)}`);
console.log(`  älter als 180 Tage: ${String(v.ab180).padStart(6)}  ${p(v.ab180)}`);
console.log(`  älter als 365 Tage: ${String(v.ab365).padStart(6)}  ${p(v.ab365)}`);
console.log(`  in den letzten 7 Tagen erneut abgerufen: ${p(v.frisch_geholt)}`);

const w = (await db.execute(sql`
  select s.display_name as name, count(*)::int n,
    round(100.0 * count(*) filter (where j.published_at < now() - interval '180 days') / count(*), 1) alt
  from jobs j
  join job_source_links l on l.job_id = j.id
  join job_sources s on s.id = l.source_id
  where j.published_at is not null
  group by 1 having count(*) > 5000 order by alt desc limit 10`)).rows;
console.log("\nAnteil über 180 Tage je Quelle");
for (const z of w) console.log(`  ${String(z.name).padEnd(26)} ${String(z.alt).padStart(5)} %   (${z.n.toLocaleString("de-DE")})`);
