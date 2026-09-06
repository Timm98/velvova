import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const q = async (s) => (await db.execute(s)).rows ?? [];
const [g] = await q(sql`select count(*)::int as n,
  count(*) filter (where salary_min is not null)::int as gehalt,
  count(*) filter (where weekly_hours is not null)::int as stunden,
  count(*) filter (where work_model is not null)::int as modell,
  count(*) filter (where contract_type is not null)::int as vertrag,
  count(*) filter (where jsonb_array_length(benefits) > 0)::int as leistungen,
  count(*) filter (where jsonb_array_length(core_tasks) > 0)::int as aufgaben,
  count(*) filter (where description_length > 800)::int as langtext,
  count(*) filter (where experience_level is not null)::int as erfahrung
  from jobs`);
console.log("Was je Stelle bekannt ist (von", g.n, "):");
for (const [k,v] of Object.entries(g)) if (k!=="n") console.log(`  ${String(v).padStart(5)}  ${((v/g.n)*100).toFixed(0).padStart(3)}%  ${k}`);
const [r] = await q(sql`select count(*)::int as n from job_requirements`);
console.log("\nAnforderungen gesamt:", r.n);
process.exit(0);
