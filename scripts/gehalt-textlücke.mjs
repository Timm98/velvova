import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { gehaltAusText } = await import("../packages/jobs/src/gehalt-aus-text.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/**
 * Wie viele Anzeigen nennen ein Gehalt im Text, das wir nicht haben?
 *
 * Gemessen, nicht vermutet. 129 der 164 gespeicherten Gehälter stammen
 * bereits aus dem Text — er ist damit die mit Abstand ergiebigste
 * Quelle, ergiebiger als jedes Anbieterfeld.
 */
const rows = (await db.execute(sql`
  select id, title, description, salary_min, salary_max from jobs
  where description is not null and length(description) > 100`)).rows;

const GELD = /(?:€|EUR|Euro|CHF|brutto)/i;
let mitGeldwort = 0, erkannt = 0, offen = 0;
const beispiele = [];

for (const r of rows) {
  const hatBereits = r.salary_min !== null || r.salary_max !== null;
  if (!GELD.test(r.description)) continue;
  mitGeldwort++;
  const b = gehaltAusText(r.description);
  if (b && (b.min !== null || b.max !== null)) {
    erkannt++;
    continue;
  }
  if (hatBereits) continue;
  /* Ein Betrag im Text, den der Erkenner nicht fasst. */
  const roh = /([\d][\d.\s]{3,8})\s*(?:€|EUR|Euro)|(?:€|EUR)\s*([\d][\d.\s]{3,8})/i.exec(r.description);
  if (roh) {
    offen++;
    if (beispiele.length < 12) {
      const i = r.description.indexOf(roh[0]);
      beispiele.push(`  „${r.title.slice(0, 40)}"\n     …${r.description.slice(Math.max(0, i - 70), i + 70).replace(/\s+/g, " ")}…`);
    }
  }
}

console.log(`Anzeigen mit Beschreibung: ${rows.length}`);
console.log(`  davon mit Geldbegriff im Text: ${mitGeldwort}`);
console.log(`  davon vom Erkenner erfasst:    ${erkannt}`);
console.log(`  Betrag im Text, NICHT erfasst: ${offen}\n`);
console.log(beispiele.join("\n"));
process.exit(0);
