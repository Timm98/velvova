import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { computeJobQuality } = await import("../packages/matching/src/jobQuality.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/**
 * Verteilt das Ranking überhaupt?
 *
 * Eine Bewertung, die bei 96 % der Stellen „nicht beurteilbar" sagt,
 * ordnet nichts — die Liste steht dann in beliebiger Reihenfolge da.
 * Diese Messung beantwortet die Frage, die man sonst nur ahnt.
 */
const rows = (await db.execute(sql`
  select id, title, salary_min, salary_max, salary_period, salary_disclosed,
         contract_type, work_model, remote_percent, shift_work, benefits, weekly_hours
  from jobs limit 1200`)).rows;

let beurteilbar = 0;
const werte = [];
for (const r of rows) {
  const q = computeJobQuality({
    job: {
      salary: {
        min: r.salary_min, max: r.salary_max, period: r.salary_period,
        disclosed: r.salary_disclosed, currency: "EUR", provenance: null, evidence: null,
      },
      contractType: r.contract_type,
      weeklyHours: r.weekly_hours,
      workModel: r.work_model,
      remotePercent: r.remote_percent,
      shiftWork: r.shift_work,
      benefits: Array.isArray(r.benefits) ? r.benefits : [],
    },
    reviews: [], themes: [],
  });
  if (!q.insufficientData && q.score !== null) { beurteilbar++; werte.push(q.score); }
}

werte.sort((a, b) => a - b);
const p = (x) => werte[Math.floor(werte.length * x)] ?? 0;
console.log(`Geprüft: ${rows.length}`);
console.log(`Beurteilbar: ${beurteilbar} (${((beurteilbar / rows.length) * 100).toFixed(1)} %)`);
if (werte.length > 0) {
  console.log(`Spanne: ${werte[0]} – ${werte[werte.length - 1]}`);
  console.log(`Median ${p(0.5)} · Quartile ${p(0.25)} / ${p(0.75)} · Dezile ${p(0.1)} / ${p(0.9)}`);
  const stufen = { "0–39": 0, "40–54": 0, "55–69": 0, "70–100": 0 };
  for (const w of werte) {
    if (w < 40) stufen["0–39"]++;
    else if (w < 55) stufen["40–54"]++;
    else if (w < 70) stufen["55–69"]++;
    else stufen["70–100"]++;
  }
  console.log("\nVerteilung:");
  for (const [k, v] of Object.entries(stufen)) {
    console.log(`  ${k.padEnd(7)} ${String(v).padStart(4)}  ${"█".repeat(Math.round((v / werte.length) * 40))}`);
  }
}
process.exit(0);
