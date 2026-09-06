/**
 * Wie viele Stellen bekommen überhaupt ein Motiv?
 *
 * Ohne erkannte Berufsgruppe bleibt der gerechnete Verlauf — ehrlich,
 * aber ohne Aussage. Diese Zahl sagt, wie oft das passiert und woran es
 * liegt.
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb, schema } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const { berufsgruppe } = await import("../apps/web/src/lib/jobs/visuals.ts");

const db = await getDb();
const jobs = await db.select({ t: schema.jobs.title }).from(schema.jobs);
const zaehler = new Map();
const ohne = [];
for (const j of jobs) {
  const g = berufsgruppe(j.t, []);
  zaehler.set(g ?? "—", (zaehler.get(g ?? "—") ?? 0) + 1);
  if (!g) ohne.push(j.t);
}
const sortiert = [...zaehler.entries()].sort((a, b) => b[1] - a[1]);
console.log(`  ${jobs.length} Stellen\n`);
for (const [g, n] of sortiert) {
  const anteil = ((n / jobs.length) * 100).toFixed(1);
  console.log(`    ${String(g).padEnd(20)} ${String(n).padStart(5)}  ${anteil} %`);
}
console.log(`\n  Häufigste Titel ohne Gruppe:`);
const haeufig = new Map();
for (const t of ohne) {
  const k = t.replace(/\(.*?\)/g, "").replace(/[mwd/\-]/g, "").trim().slice(0, 34);
  haeufig.set(k, (haeufig.get(k) ?? 0) + 1);
}
for (const [t, n] of [...haeufig.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`    ${String(n).padStart(4)}×  ${t}`);
}
process.exit(0);
