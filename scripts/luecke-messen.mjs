import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Wie weit sind wir — je Quelle, gegen ihre gemessene Decke.
 *
 * „Haben wir das Limit erreicht" ist keine Frage nach einer Zahl,
 * sondern nach dem Abstand zu ihr. Und der ist je Quelle sehr
 * verschieden: Bei einer sind wir fast durch, bei einer anderen haben
 * wir noch nicht angefangen.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/* Gemessen am 3.9.2026 über die Zählungen der Anbieter. */
const DECKEN = {
  "Bundesagentur für Arbeit": 999_398,
  "Adzuna Deutschland": 1_162_938,
  "Adzuna Schweiz": 81_500,
  "Adzuna Österreich": 33_018,
  "Adzuna USA": 6_647_897,
  "Adzuna Frankreich": 952_787,
  "Adzuna Brasilien": 775_602,
  "Adzuna Grossbritannien": 746_511,
  "Adzuna Italien": 297_139,
  "Adzuna Indien": 258_759,
  "Adzuna Kanada": 258_570,
  "Adzuna Australien": 243_458,
  "Adzuna Niederlande": 209_793,
  "Adzuna Mexiko": 177_977,
  "Adzuna Spanien": 128_482,
  "Adzuna Polen": 127_234,
  "Adzuna Südafrika": 97_836,
  "Adzuna Belgien": 80_720,
  "Adzuna Singapur": 51_499,
  "Adzuna Neuseeland": 10_348,
  "Arbeitnow": 2_100,
};

const haben = new Map((await db.execute(sql`
  select s.display_name q, count(*)::int n from jobs j
  join job_sources s on s.id = j.source_id where j.is_demo = false
  group by 1`)).rows.map((r) => [r.q, Number(r.n)]));

console.log("Quelle                       haben      Decke    offen");
console.log("─".repeat(60));
let summeHaben = 0, summeDecke = 0;
for (const [q, decke] of Object.entries(DECKEN)) {
  const n = haben.get(q) ?? 0;
  summeHaben += n;
  summeDecke += decke;
  const anteil = (100 * n) / decke;
  console.log(
    `${q.padEnd(26)} ${String(n).padStart(7)} ${String(decke).padStart(10)}  ${anteil.toFixed(1).padStart(5)} %`,
  );
}
console.log("─".repeat(60));
console.log(`${"zusammen".padEnd(26)} ${String(summeHaben).padStart(7)} ${String(summeDecke).padStart(10)}  ${((100*summeHaben)/summeDecke).toFixed(1).padStart(5)} %`);
console.log(`\nNoch nicht geholt: ${(summeDecke - summeHaben).toLocaleString("de-DE")} Anzeigen.`);
process.exit(0);
