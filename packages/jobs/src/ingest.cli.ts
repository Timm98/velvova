import { loadRuntimeConfig } from "@paycheck/config";
import { activeAdapters, sourceStatuses } from "./registry.ts";
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

const limitJeQuelle = Number(process.argv[2] ?? 1000);
const cfg = loadRuntimeConfig();
const adapters = activeAdapters(cfg);

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
