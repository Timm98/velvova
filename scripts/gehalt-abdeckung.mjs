import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const q = async (s) => (await db.execute(s)).rows ?? [];

const [g] = await q(sql`select count(*)::int as n,
  count(*) filter (where salary_min is not null or salary_max is not null)::int as mit from jobs`);
console.log(`Stellen: ${g.n} · mit Gehalt: ${g.mit} (${((g.mit / g.n) * 100).toFixed(1)} %)\n`);

const je = await q(sql`
  select s.display_name as quelle, count(*)::int as n,
    count(*) filter (where j.salary_min is not null or j.salary_max is not null)::int as mit
  from jobs j join job_sources s on s.id = j.source_id group by 1 order by n desc`);
console.log("Je Quelle:");
for (const r of je) {
  console.log(`  ${String(r.mit).padStart(4)} / ${String(r.n).padStart(4)}  ${((r.mit / r.n) * 100).toFixed(1).padStart(5)} %  ${r.quelle}`);
}

const her = await q(sql`
  select coalesce(salary_provenance::text, '—') as h, count(*)::int as n from jobs
  where salary_min is not null or salary_max is not null group by 1 order by n desc`);
console.log("\nHerkunft der Zahl:");
for (const r of her) console.log(`  ${String(r.n).padStart(4)}  ${r.h}`);
process.exit(0);
