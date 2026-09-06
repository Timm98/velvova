import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Welche Filterkombination fördert am meisten Neues zutage?
 *
 * Jede Kombination bekommt denselben Wortschatz-Ausschnitt, damit die
 * Ausbeute vergleichbar ist. Gemessen wird „neu je 1.000 geholt" —
 * geholte Anzeigen kosten Zeit, neue sind der Ertrag.
 */
const { BundesagenturAdapter } = await import("../packages/jobs/src/sources/bundesagentur.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");
const { berufsabfragen } = await import("../packages/jobs/src/berufsabfragen.ts");
const { getDb } = await import("../packages/db/src/index.ts");
const { sql } = await import("../packages/db/node_modules/drizzle-orm/index.js");
const db = await getDb();

const KOMBINATIONEN = [
  { name: "ohne Filter",              zusatz: {} },
  { name: "Teilzeit",                 zusatz: { arbeitszeit: "tz" } },
  { name: "Teilzeit + ohne Zeitarb.", zusatz: { arbeitszeit: "tz", zeitarbeit: "false" } },
  { name: "Vollzeit + befristet",     zusatz: { arbeitszeit: "vz", befristung: "1" } },
  { name: "Vollzeit + ohne Zeitarb.", zusatz: { arbeitszeit: "vz", zeitarbeit: "false" } },
  { name: "Schicht/Nacht/Wochenend",  zusatz: { arbeitszeit: "snw" } },
  { name: "Heimarbeit",               zusatz: { arbeitszeit: "ho" } },
  { name: "befristet + Teilzeit",     zusatz: { befristung: "1", arbeitszeit: "tz" } },
];

const berufe = (await berufsabfragen(600)).slice(0, 25);
console.log(`${KOMBINATIONEN.length} Kombinationen · je ${berufe.length} Begriffe\n`);
console.log("Kombination".padEnd(28), "geholt".padStart(8), "neu".padStart(7), "je 1.000".padStart(10));

const ergebnisse = [];
for (const k of KOMBINATIONEN) {
  try {
    const r = await ingestFromAdapter(
      new BundesagenturAdapter({ abfragen: berufe, zusatz: k.zusatz, pauseMs: 60, gleichzeitig: 6 }),
      { limit: 1500 },
    );
    const je = r.fetched > 0 ? (1000 * r.inserted) / r.fetched : 0;
    ergebnisse.push({ ...k, ...r, je });
    console.log(
      k.name.padEnd(28),
      String(r.fetched).padStart(8),
      String(r.inserted).padStart(7),
      je.toFixed(0).padStart(10),
    );
  } catch (e) {
    console.log(k.name.padEnd(28), `  ! ${String(e instanceof Error ? e.message : e).slice(0, 50)}`);
  }
}

ergebnisse.sort((a, b) => b.je - a.je);
console.log(`\nBeste Achse: „${ergebnisse[0]?.name}" mit ${ergebnisse[0]?.je.toFixed(0)} neuen je 1.000 geholt.`);
process.exit(0);
