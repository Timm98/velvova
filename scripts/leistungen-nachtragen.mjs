import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { leistungsnamen } = await import("../packages/jobs/src/leistungen.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

/**
 * Trägt die Leistungen für bereits gespeicherte Stellen nach.
 *
 * Der Erkenner läuft ab jetzt beim Import. Die 1.500 Anzeigen, die schon
 * in der Datenbank liegen, wurden ohne ihn geschrieben — sie bekämen die
 * Angabe erst, wenn der Anbieter sie erneut liefert und der Inhalt sich
 * ändert. Das kann Wochen dauern oder nie passieren.
 *
 * TROCKENLAUF IST DIE VOREINSTELLUNG. Geschrieben wird nur mit
 * `--schreiben`, und auch dann nur dort, wo bisher nichts steht: Was ein
 * Anbieter ausdrücklich geliefert hat, wird nicht überschrieben.
 */
const schreiben = process.argv.includes("--schreiben");
const rows = (await db.execute(sql`select id, description, benefits from jobs`)).rows;

let leer = 0;
let neu = 0;
let unveraendert = 0;
const beispiele = [];

for (const r of rows) {
  const vorhanden = Array.isArray(r.benefits) ? r.benefits : [];
  if (vorhanden.length > 0) { unveraendert++; continue; }
  leer++;
  const gefunden = leistungsnamen(r.description);
  if (gefunden.length === 0) continue;
  neu++;
  if (beispiele.length < 5) beispiele.push(gefunden.join(", "));
  if (schreiben) {
    await db.execute(sql`update jobs set benefits = ${JSON.stringify(gefunden)}::jsonb where id = ${r.id}`);
  }
}

console.log(`${schreiben ? "GESCHRIEBEN" : "TROCKENLAUF"} — ${rows.length} Stellen geprüft`);
console.log(`  ${unveraendert} hatten bereits Angaben vom Anbieter (unberührt)`);
console.log(`  ${leer} waren leer, davon ${neu} mit Leistungen im Text`);
console.log(`  ${leer - neu} nennen im Text keine Leistung`);
for (const b of beispiele) console.log(`    z. B. ${b}`);
if (!schreiben) console.log("\nZum Schreiben: node --experimental-strip-types scripts/leistungen-nachtragen.mjs --schreiben");
process.exit(0);
