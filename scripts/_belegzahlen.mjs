import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
await db.execute(sql`set statement_timeout = '900s'`);
const [a] = (await db.execute(sql`
  select
    count(*)::int gesamt,
    count(*) filter (where salary_disclosed)::int mit_gehalt,
    count(*) filter (where published_at < now() - interval '6 months')::int alt,
    count(*) filter (where shift_work)::int schicht,
    count(*) filter (where contract_type = 'fixed_term')::int befristet
  from jobs where is_demo = false and country = 'DE'`)).rows;
const p = (n) => Math.round((n / a.gesamt) * 1000) / 10;
console.log(`DE gesamt ${a.gesamt.toLocaleString("de")}`);
console.log(`  mit angegebenem Gehalt: ${p(a.mit_gehalt)} %`);
console.log(`  älter als 6 Monate:     ${p(a.alt)} %`);
console.log(`  Schicht/Nacht/Wochenende: ${p(a.schicht)} %`);
console.log(`  befristet:              ${p(a.befristet)} %`);
process.exit(0);
