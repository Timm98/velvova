/*
 * Zuerst die Umgebung, dann alles andere.
 *
 * Diese Zeile muss VOR jedem Import stehen, der Konfiguration liest.
 * `loadRuntimeConfig()` wertet `process.env` beim Aufruf aus — wird die
 * Datei erst danach geladen, ist die Konfiguration schon gebildet, und
 * zwar aus einer leeren Umgebung.
 *
 * Was ohne diese Zeile geschah: der Lauf sah keinen einzigen Schlüssel,
 * übersprang jede Quelle, die einen braucht, und schrieb seine
 * Ergebnisse mangels `DATABASE_URL` in die eingebettete Datenbank statt
 * nach Supabase. Gemeldet wurde „10 neu · 0 fehlerhaft".
 */
import { ladeEnvDatei } from "@paycheck/config/node";
const env = ladeEnvDatei();

import { loadRuntimeConfig } from "@paycheck/config";
import { activeAdapters, sourceStatuses, ATS_BOARDS, setBoardRegistrations } from "./registry.ts";
import { loadRegistrations } from "./sources/ats/registrations.ts";
import { berufsabfragen } from "./berufsabfragen.ts";
import { ingestFromAdapter } from "./ingest.ts";

/**
 * Echte Stellen abrufen — aus ALLEN aktiven Quellen.
 *
 * Aufruf: `pnpm jobs:refresh [anzahl je Quelle]`
 *
 * Was hier vorher stand und warum es falsch war:
 *
 *   const limit = Number(process.argv[2] ?? 100);
 *   await ingestFromAdapter(new ArbeitnowAdapter(), { limit });
 *
 * Zwei Fehler in zwei Zeilen. Erstens war genau ein Anbieter fest
 * verdrahtet — die Registry mit allen eingerichteten Quellen wurde nie
 * gefragt. Wer `JOB_SOURCES` erweiterte, änderte damit nichts. Zweitens
 * war die Voreinstellung 100, und Arbeitnow liefert 175 auf der ersten
 * Seite: die Schleife brach nach Seite eins ab und schnitt auf 100.
 *
 * Ergebnis: 100 Stellen in der Datenbank, davon nach Abzug toter Links
 * und Ausschlusskriterien gut zwanzig sichtbar. Genau die Zahl, über die
 * sich niemand erklären konnte, woher sie kommt.
 *
 * Der Lauf ist wiederholbar — zweimal ausgeführt entsteht nichts
 * doppelt. Er wird bewusst von Hand oder vom Arbeiter angestoßen und
 * nicht beim Start der Anwendung: ein Abruf, der bei jedem Neustart
 * losläuft, wird schnell zur Belästigung der Quelle.
 */

/*
 * Ein unbrauchbares Limit bricht den Lauf ab, statt still nichts zu holen.
 *
 * `Number("--source")` ist NaN, und `slice(0, NaN)` ist die leere
 * Liste. Ein Aufruf mit einem Schalter, den es hier nie gab, lief
 * deshalb durch alle 28 Quellen, meldete überall „geholt 0" und
 * endete ohne Fehler — nicht von einem Lauf zu unterscheiden, bei
 * dem es tatsächlich nichts Neues gab. Genau diese Verwechslung
 * kostet die Zeit, die eine Ernte einsparen soll.
 */
const limitArg = process.argv[2];
const limitJeQuelle = limitArg === undefined ? 1000 : Number(limitArg);
if (!Number.isInteger(limitJeQuelle) || limitJeQuelle < 1) {
  console.error(
    `Unbrauchbares Limit ${JSON.stringify(limitArg)}. ` +
      "Erwartet wird eine ganze Zahl ab 1 als erstes Argument, sonst nichts. " +
      "Beispiel: pnpm jobs:refresh 250",
  );
  process.exit(1);
}
const cfg = loadRuntimeConfig();

/*
 * Der Suchwortschatz kommt aus der Datenbank, nicht aus dem Code.
 *
 * Ohne ihn sucht die Jobbörse mit fünf fest eingetragenen Begriffen —
 * und liefert 327 Anzeigen aus einem Bestand von 999.398. Die
 * amtlichen Berufsbezeichnungen in `beruf_zuordnung` sind ihr eigenes
 * Vokabular; danach zu suchen findet, was es gibt.
 */
const berufe = await berufsabfragen().catch(() => []);
if (berufe.length > 0) {
  console.log(`Suchwortschatz: ${berufe.length} amtliche Berufsbezeichnungen.`);
}
/*
 * Die Arbeitgeberboards zuerst laden.
 *
 * Ohne diese Zeilen fragt der ATS-Adapter niemanden: Seine
 * Registrierungen stehen in einer Map, die der Aufrufer füllt, und
 * die CLI füllte sie nie. Die vier ATS-Quellen meldeten deshalb
 * „Zugangsdaten fehlen" — auch dann, wenn in `employer_boards`
 * verifizierte Arbeitgeber standen.
 *
 * Der Endpunkt `api/jobs/refresh` machte es richtig; die CLI hatte
 * es nie mitbekommen. Zwei Wege in dieselbe Ernte, und einer davon
 * liess vier Quellen aus.
 */
for (const board of ATS_BOARDS) {
  setBoardRegistrations(board, await loadRegistrations(board));
}

const adapters = activeAdapters(cfg, { berufe });

/*
 * Wohin geschrieben wird, steht vor dem Lauf da.
 *
 * Der Lauf, der still in die eingebettete Datenbank schrieb, meldete
 * „10 neu" und sah erfolgreich aus. Die Zeile hier hätte ihn in einer
 * Sekunde entlarvt.
 */
const cfgJetzt = loadRuntimeConfig();
console.log(
  `Umgebung: ${env.geladen ? ".env.local geladen" : "keine .env.local — nur Systemumgebung"} · ` +
    `Datenbank: ${cfgJetzt.db.driver === "pg" ? "Postgres (extern)" : "PGlite (lokale Datei)"}\n`,
);

console.log("── Quellenlage ──");
for (const s of sourceStatuses(cfg)) {
  console.log(`  ${s.active ? "aktiv " : "aus   "} ${s.key.padEnd(24)} ${s.reason}`);
}

if (adapters.length === 0) {
  console.log("\nKeine aktive Quelle. Es wird nichts abgerufen — und nichts erfunden.");
  process.exit(0);
}

console.log(`\n── Abruf, höchstens ${limitJeQuelle} je Quelle ──`);

/*
 * Nacheinander, nicht parallel.
 *
 * Es sind wenige Quellen, und jede hat eigene Rate Limits. Sie
 * gleichzeitig zu befragen spart hier höchstens Sekunden und riskiert,
 * bei einer davon gesperrt zu werden. Die parallele Suche gehört in den
 * Live-Pfad, wo ein Mensch wartet — nicht in einen Hintergrundlauf.
 */
const ergebnisse: Awaited<ReturnType<typeof ingestFromAdapter>>[] = [];
for (const adapter of adapters) {
  const t0 = Date.now();
  try {
    const r = await ingestFromAdapter(adapter, { limit: limitJeQuelle });
    ergebnisse.push(r);
    const dauer = Math.round((Date.now() - t0) / 100) / 10;
    console.log(
      `  ${r.sourceKey.padEnd(24)} geholt ${String(r.fetched).padStart(5)} · ` +
        `neu ${String(r.inserted).padStart(5)} · aktualisiert ${String(r.updated).padStart(4)} · ` +
        `unverändert ${String(r.unchanged).padStart(5)} · fehlerhaft ${r.failed} · ${dauer}s`,
    );
    for (const e of r.errors.slice(0, 3)) console.error(`      ! ${e}`);
  } catch (fehler) {
    // Eine ausgefallene Quelle darf die anderen nicht mitnehmen.
    console.error(
      `  ${adapter.key.padEnd(24)} FEHLGESCHLAGEN: ` +
        (fehler instanceof Error ? fehler.message.slice(0, 120) : String(fehler)),
    );
  }
}

const summe = (feld: "fetched" | "inserted" | "updated" | "failed") =>
  ergebnisse.reduce((s, r) => s + r[feld], 0);

console.log(
  `\n${adapters.length} Quelle(n) · ${summe("fetched")} Roh-Treffer · ` +
    `${summe("inserted")} neu · ${summe("updated")} aktualisiert · ${summe("failed")} fehlerhaft`,
);

process.exit(summe("fetched") === 0 && summe("failed") > 0 ? 1 : 0);
