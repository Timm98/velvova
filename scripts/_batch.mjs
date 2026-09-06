import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Wie schnell könnte geschrieben werden, wenn gebündelt würde?
 *
 * Gemessen wurde: 6,7 Anzeigen je Sekunde im echten Lauf. Das sind
 * rund 150 ms je Anzeige — bei einer Datenbank in der Cloud die
 * typische Signatur mehrerer Hin- und Rückwege je Datensatz.
 *
 * Diese Messung schreibt in eine Wegwerf-Tabelle, nicht nach `jobs`.
 * Es geht um die Frage, was die Leitung hergibt, nicht darum, Daten zu
 * erzeugen.
 */
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

await db.execute(sql`create temporary table tempo_probe (id serial primary key, a text, b text, c int)`);

async function messen(name, n, proBuendel) {
  const t = Date.now();
  for (let i = 0; i < n; i += proBuendel) {
    const zeilen = [];
    for (let j = 0; j < proBuendel && i + j < n; j++) {
      zeilen.push(sql`(${"titel " + (i + j)}, ${"firma " + (i + j)}, ${i + j})`);
    }
    await db.execute(sql`insert into tempo_probe (a, b, c) values ${sql.join(zeilen, sql`, `)}`);
  }
  const s = (Date.now() - t) / 1000;
  console.log(`  ${name.padEnd(28)} ${n} Zeilen in ${s.toFixed(1)} s → ${(n / s).toFixed(0)}/s`);
  return n / s;
}

const einzeln = await messen("einzeln (1 je Anweisung)", 300, 1);
const gebuendelt = await messen("gebündelt (500 je Anweisung)", 5000, 500);
console.log(`\n  Faktor: ${(gebuendelt / einzeln).toFixed(0)}×`);
console.log(`  1.000.000 Zeilen einzeln:    ${((1_000_000 / einzeln) / 3600).toFixed(1)} Stunden`);
console.log(`  1.000.000 Zeilen gebündelt:  ${((1_000_000 / gebuendelt) / 60).toFixed(0)} Minuten`);
process.exit(0);
