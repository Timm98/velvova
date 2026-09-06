import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const q = async (s) => (await db.execute(s)).rows ?? [];

const [g] = await q(sql`select count(*)::int as n from jobs`);
console.log(`Stellen gesamt: ${g.n}`);

const gleich = await q(sql`
  select lower(trim(j.title)) as titel, lower(trim(c.name)) as firma,
         lower(trim(j.location)) as ort, count(*)::int as n
  from jobs j join companies c on c.id = j.company_id
  group by 1,2,3 having count(*) > 1 order by n desc limit 12`);
const summe = gleich.reduce((a, r) => a + r.n - 1, 0);
console.log(`Titel+Firma+Ort mehrfach: ${gleich.length} Gruppen, ${summe} überzählige Zeilen`);
for (const r of gleich.slice(0, 6)) console.log(`  ${r.n}×  ${r.titel.slice(0,50)} — ${r.firma.slice(0,28)} — ${r.ort.slice(0,20)}`);

const [h] = await q(sql`select count(*)::int as n from (select content_hash from jobs group by content_hash having count(*) > 1) x`);
console.log(`\nGleicher content_hash: ${h.n} Gruppen`);

const quellen = await q(sql`
  select s.display_name as quelle, count(*)::int as n from jobs j
  join job_sources s on s.id = j.source_id group by 1 order by n desc`);
console.log("\nJe Quelle:");
for (const r of quellen) console.log(`  ${String(r.n).padStart(5)}  ${r.quelle}`);
process.exit(0);
