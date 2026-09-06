import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const r = (await db.execute(sql`
  with namen as (
    select raw_payload->>'hauptberuf' as beruf, count(distinct job_id)::int as n
    from job_snapshots where raw_payload ? 'hauptberuf' group by 1
  )
  select count(*)::int verschiedene,
         count(*) filter (where exists (select 1 from beruf_schluessel s where s.beruf = namen.beruf and s.schluessel is not null))::int treffer,
         sum(n)::int stellen,
         sum(n) filter (where exists (select 1 from beruf_schluessel s where s.beruf = namen.beruf and s.schluessel is not null))::int stellen_treffer
  from namen`)).rows[0];
console.log(`  verschiedene hauptberuf-Werte  ${Number(r.verschiedene).toLocaleString("de-DE").padStart(10)}`);
console.log(`  davon im DKZ gefunden          ${Number(r.treffer).toLocaleString("de-DE").padStart(10)}`);
console.log(`  Stellen dahinter               ${Number(r.stellen).toLocaleString("de-DE").padStart(10)}`);
console.log(`  davon zuzuordnen               ${Number(r.stellen_treffer).toLocaleString("de-DE").padStart(10)}`);
const fehlt = (await db.execute(sql`
  select raw_payload->>'hauptberuf' as beruf, count(distinct job_id)::int as n
  from job_snapshots where raw_payload ? 'hauptberuf'
    and not exists (select 1 from beruf_schluessel s where s.beruf = raw_payload->>'hauptberuf' and s.schluessel is not null)
  group by 1 order by n desc limit 8`)).rows;
console.log("\n  Häufigste ohne DKZ-Entsprechung:");
for (const x of fehlt) console.log(`    ${String(x.n).padStart(6)}  ${String(x.beruf).slice(0,54)}`);
process.exit(0);
