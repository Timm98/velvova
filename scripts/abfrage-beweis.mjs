/**
 * Fragt die Bundesagentur wirklich nach dem neuen Begriff?
 *
 * Die Tests zeigen, dass der Begriff im Adapter ankommt. Sie zeigen
 * nicht, dass er auch abgeschickt wird — das ist der Unterschied
 * zwischen „verdrahtet" und „wirkt".
 *
 * Ein kleiner echter Abruf, zwei Läufe: einmal ohne, einmal mit. Die
 * Quelle ist staatlich und kostenlos.
 */
import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();
const { BundesagenturAdapter, STANDARDSUCHEN } = await import("../packages/jobs/src/sources/bundesagentur.ts");

const zeig = async (name, abfragen) => {
  const a = new BundesagenturAdapter({ abfragen });
  const t0 = Date.now();
  const listings = await a.fetchListings({ limit: 90 });
  const titel = listings.map((l) => l.title ?? "").filter(Boolean);
  console.log(`\n  ${name} (${abfragen.length} Begriffe, ${Date.now() - t0} ms)`);
  console.log(`    ${listings.length} Anzeigen`);
  for (const t of titel.slice(0, 5)) console.log(`      ${t.slice(0, 66)}`);
  return titel;
};

const ohne = await zeig("Nur Grundausstattung", STANDARDSUCHEN);
const mit = await zeig("Plus Personalsachbearbeitung", [...STANDARDSUCHEN, "Personalsachbearbeitung"]);

const neu = mit.filter((t) => !ohne.includes(t));
console.log(`\n  ${neu.length} Titel, die es ohne den zusätzlichen Begriff nicht gab:`);
for (const t of neu.slice(0, 6)) console.log(`    ${t.slice(0, 70)}`);
console.log(`\n  ${neu.length > 0 ? "ok  " : "!!  "} Der zusätzliche Begriff bringt tatsächlich andere Stellen.`);
process.exit(0);
