import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Was eine Quelle für das Ranking hergibt — nicht wie viele Zeilen.
 *
 * Die Rangfolge dieses Produkts hängt an Gehalt, Beschreibungstext,
 * Wochenstunden, Vertragsart und Leistungen. Eine Quelle mit einer
 * Million Zeilen ohne diese Felder liefert eine Million Zeilen, keine
 * Million bewertbarer Stellen.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const r = (await db.execute(sql`
  select s.display_name q, count(*)::int n,
    round(100.0 * count(*) filter (where j.salary_min is not null or j.salary_max is not null) / count(*), 1) gehalt,
    round(100.0 * count(*) filter (where j.salary_disclosed) / count(*), 1) zugesagt,
    round(avg(j.description_length))::int text,
    round(100.0 * count(*) filter (where j.weekly_hours is not null) / count(*), 1) stunden,
    round(100.0 * count(*) filter (where j.contract_type is not null) / count(*), 1) vertrag,
    round(100.0 * count(*) filter (where jsonb_array_length(j.benefits) > 0) / count(*), 1) leistungen
  from jobs j join job_sources s on s.id = j.source_id
  where j.is_demo = false group by 1 having count(*) > 20 order by 2 desc`)).rows;

console.log("Quelle                     Zeilen   Gehalt  zugesagt   Ø Text  Stunden  Vertrag  Leistungen");
console.log("─".repeat(92));
for (const x of r) {
  console.log(
    `${String(x.q).padEnd(26)} ${String(x.n).padStart(6)}  ${String(x.gehalt).padStart(5)} %  ${String(x.zugesagt).padStart(6)} %  ${String(x.text).padStart(6)}  ${String(x.stunden).padStart(6)} %  ${String(x.vertrag).padStart(6)} %  ${String(x.leistungen).padStart(8)} %`,
  );
}
process.exit(0);
