import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { leistungenAusText } = await import("../packages/jobs/src/leistungen.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/**
 * Was der Erkenner an den echten Anzeigen findet.
 *
 * Vor dem Verdrahten gemessen, nicht danach: Ein Erkenner, der an
 * Testsätzen funktioniert und an echten Texten nichts findet, ist an
 * den Tests vorbeigebaut.
 */
const rows = (await db.execute(sql`select id, title, description from jobs`)).rows;
const zaehler = new Map();
let mitMind = 0;
let summe = 0;
const beispiele = [];

for (const r of rows) {
  const l = leistungenAusText(r.description);
  if (l.length > 0) { mitMind++; summe += l.length; }
  for (const x of l) zaehler.set(x.label, (zaehler.get(x.label) ?? 0) + 1);
  if (beispiele.length < 3 && l.length >= 4) beispiele.push({ t: r.title, l });
}

console.log(`Stellen: ${rows.length}`);
console.log(`Mindestens eine Leistung erkannt: ${mitMind} (${((mitMind / rows.length) * 100).toFixed(1)} %)`);
console.log(`Durchschnitt bei erkannten: ${(summe / Math.max(1, mitMind)).toFixed(1)} Leistungen`);
console.log("");
for (const [label, n] of [...zaehler].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(5)}  ${((n / rows.length) * 100).toFixed(1).padStart(5)} %  ${label}`);
}
console.log("\nBeispiele:");
for (const b of beispiele) {
  console.log(`\n  ${b.t.slice(0, 70)}`);
  for (const x of b.l) console.log(`    ${x.label}${x.wert ? ` (${x.wert})` : ""}: „${x.beleg.slice(0, 90)}"`);
}
process.exit(0);
