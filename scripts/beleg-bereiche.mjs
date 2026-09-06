/**
 * Welche Bereiche decken die Belege tatsächlich ab?
 *
 * `recomputeCoverage` zählt sieben Bereiche und erkennt sie am
 * `sourceRef`. Stimmt keine der Kennungen mit den erwarteten Namen
 * überein, ist die Abdeckung immer null — und der Fortschrittsbalken
 * steht still, obwohl Belege vorhanden sind.
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { getDb, schema } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");

const BEREICHE = [
  "experience_episodes", "tasks_and_energy", "hard_constraints",
  "location_and_logistics", "work_style_and_environment",
  "values_and_motives", "background",
];

const db = await getDb();
const refs = await db
  .select({ ref: schema.evidenceItems.sourceRef, bestaetigt: schema.evidenceItems.userConfirmed, n: sql`count(*)::int` })
  .from(schema.evidenceItems)
  .groupBy(schema.evidenceItems.sourceRef, schema.evidenceItems.userConfirmed)
  .orderBy(sql`count(*) desc`)
  .limit(25);

console.log("  sourceRef (Anzahl · bestätigt?) → trifft einen Bereich?");
for (const r of refs) {
  const treffer = BEREICHE.find((b) => r.ref?.includes(b));
  console.log(`    ${String(r.ref).padEnd(46)} ${String(r.n).padStart(4)} · ${r.bestaetigt ? "ja " : "nein"} → ${treffer ?? "—"}`);
}
const bestaetigt = await db.select({ n: sql`count(*)::int` }).from(schema.evidenceItems).where(sql`user_confirmed = true`);
console.log(`\n  Bestätigte Belege insgesamt: ${bestaetigt[0].n}`);

const themen = await db
  .select({ thema: sql`split_part(source_ref, ':', 3)`, n: sql`count(*)::int` })
  .from(schema.evidenceItems)
  .where(sql`source_ref like 'nina:v3:%'`)
  .groupBy(sql`split_part(source_ref, ':', 3)`)
  .orderBy(sql`count(*) desc`);
console.log("\n  Alle nina:v3-Themen:");
for (const t of themen) console.log(`    ${String(t.thema).padEnd(28)} ${t.n}`);

const alt = await db
  .select({ thema: sql`split_part(source_ref, ':', 2)`, n: sql`count(*)::int` })
  .from(schema.evidenceItems)
  .where(sql`source_ref like 'interview:%'`)
  .groupBy(sql`split_part(source_ref, ':', 2)`)
  .orderBy(sql`count(*) desc`);
console.log("\n  Alle interview-Bereiche:");
for (const t of alt) console.log(`    ${String(t.thema).padEnd(28)} ${t.n}`);
process.exit(0);
