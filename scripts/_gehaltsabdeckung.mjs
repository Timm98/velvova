import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/**
 * Wie viele deutsche Stellen zeigen künftig eine Gehaltsangabe?
 *
 * Drei Stufen: eigene Angabe, Referenz über die amtliche Kennung,
 * gar nichts. Der Titelweg ist hier nicht gerechnet — er kommt
 * zusätzlich dazu.
 */
const [a] = (await db.execute(sql`
  select
    count(*)::int gesamt,
    count(*) filter (where j.salary_min is not null or j.salary_max is not null)::int eigene,
    count(*) filter (where (j.salary_min is null and j.salary_max is null)
                       and exists (select 1 from entgelt_kldb e where e.kldb = j.kldb))::int referenz
  from jobs j tablesample system (4)
  where j.country = 'DE'`)).rows;
const p = (x) => `${((x/a.gesamt)*100).toFixed(1)} %`;
console.log(`Stichprobe ${a.gesamt.toLocaleString("de-DE")} deutsche Stellen`);
console.log(`  eigene Gehaltsangabe        ${String(a.eigene).padStart(6)}  ${p(a.eigene)}`);
console.log(`  Referenz über KldB          ${String(a.referenz).padStart(6)}  ${p(a.referenz)}`);
console.log(`  ────────────────────────────────────────────`);
console.log(`  mit Gehaltsorientierung     ${String(a.eigene + a.referenz).padStart(6)}  ${p(a.eigene + a.referenz)}`);
console.log(`  ohne                        ${String(a.gesamt - a.eigene - a.referenz).padStart(6)}  ${p(a.gesamt - a.eigene - a.referenz)}`);
