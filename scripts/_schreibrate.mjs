import { ladeEnvDatei } from "../packages/config/src/env-datei.ts";
ladeEnvDatei();

/**
 * Wie viele Anzeigen je Sekunde landen wirklich in der Datenbank?
 *
 * Für jeden Plan mit sechsstelligen Zielen ist das die entscheidende
 * Zahl — und sie steht nirgends. Der Abruf lässt sich beschleunigen,
 * das Schreiben nicht ohne Weiteres.
 *
 * Gemessen wird der ganze Lauf und davon der Abruf abgezogen. Ein
 * Adapter-Doppelgänger wäre genauer, verlöre aber die Methoden der
 * Klasse — ein erster Versuch damit meldete „0 verarbeitet".
 */
const { AdzunaAdapter } = await import("../packages/jobs/src/sources/adzuna.ts");
const { ingestFromAdapter } = await import("../packages/jobs/src/ingest.ts");

const tAbruf = Date.now();
const vorab = await new AdzunaAdapter({ country: "ch" }).fetchListings({ limit: 300 });
const abrufS = (Date.now() - tAbruf) / 1000;

const tGesamt = Date.now();
const r = await ingestFromAdapter(new AdzunaAdapter({ country: "ch" }), { limit: 300 });
const gesamtS = (Date.now() - tGesamt) / 1000;
const schreibS = Math.max(0.1, gesamtS - abrufS);

console.log(`Abruf:      ${vorab.length} Anzeigen in ${abrufS.toFixed(1)} s → ${(vorab.length / abrufS).toFixed(1)}/s`);
console.log(`Gesamtlauf: ${r.fetched} verarbeitet (${r.inserted} neu, ${r.unchanged} unverändert) in ${gesamtS.toFixed(1)} s`);
console.log(`Schreiben:  rund ${schreibS.toFixed(1)} s → ${(r.fetched / schreibS).toFixed(1)}/s`);
const rate = r.fetched / schreibS;
console.log(`\n1.000.000 Anzeigen nur zum Schreiben: ${((1_000_000 / rate) / 3600).toFixed(1)} Stunden`);
process.exit(0);
