import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { gehaltAusText } = await import("../packages/jobs/src/gehalt-aus-text.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/**
 * Gehälter für bereits gespeicherte Anzeigen nachtragen.
 *
 * Der verbesserte Erkenner läuft ab jetzt beim Import. Die Anzeigen,
 * die schon in der Datenbank liegen, wurden mit der alten Fassung
 * geschrieben — sie bekämen die Angabe erst, wenn der Anbieter sie
 * erneut liefert und der Inhalt sich ändert.
 *
 * TROCKENLAUF IST DIE VOREINSTELLUNG. Geschrieben wird nur mit
 * `--schreiben`, und nur dort, wo bisher gar nichts steht — eine
 * Angabe des Anbieters wird nie überschrieben.
 */
const schreiben = process.argv.includes("--schreiben");
const rows = (await db.execute(sql`
  select id, title, description from jobs
  where salary_min is null and salary_max is null
    and description is not null and length(description) > 100`)).rows;

let neu = 0;
const beispiele = [];
for (const r of rows) {
  const b = gehaltAusText(r.description);
  if (!b || (b.min === null && b.max === null)) continue;
  neu++;
  if (beispiele.length < 6) {
    beispiele.push(`  ${b.min}–${b.max ?? "?"} ${b.currency}/${b.period}  „${r.title.slice(0, 44)}"`);
  }
  if (schreiben) {
    await db.execute(sql`
      update jobs set salary_min = ${b.min}, salary_max = ${b.max},
        salary_currency = ${b.currency}, salary_period = ${b.period},
        salary_provenance = 'text', salary_evidence = ${b.beleg},
        salary_disclosed = false
      where id = ${r.id}`);
  }
}

console.log(`${schreiben ? "GESCHRIEBEN" : "TROCKENLAUF"} — ${rows.length} Anzeigen ohne Gehalt geprüft`);
console.log(`  ${neu} mit Betrag im Text\n`);
console.log(beispiele.join("\n"));
if (!schreiben) console.log("\nZum Schreiben: --schreiben");
process.exit(0);
