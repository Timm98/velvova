import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();
const messen = async (name, fn) => { const t = Date.now(); const r = await fn(); console.log(`  ${name.padEnd(38)} ${Date.now() - t} ms`); return r; };

// Genau die Abfrage aus gehaltsvergleich.ts
await messen("Gehaltsstatistik (alle mit Gehalt)", () => db.execute(sql`
  select j.title, j.core_tasks, j.salary_min, j.salary_max, j.salary_period,
         j.weekly_hours, c.name as firma
  from jobs j join companies c on c.id = j.company_id
  where (j.salary_min is not null or j.salary_max is not null)`));

await messen("eine Beschreibung nachladen", () => db.execute(sql`
  select description from jobs where is_demo = false limit 1`));

await messen("Referenz für einen Titel", () => db.execute(sql`
  select e.* from beruf_zuordnung z join beruf_entgelt e on e.beruf = z.beruf
  where z.titel = 'disponent'`));
process.exit(0);
