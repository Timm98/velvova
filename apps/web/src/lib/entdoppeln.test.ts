import { describe, expect, it } from "vitest";
import { entdoppeln } from "./matching.ts";
import type { ScoredJob } from "./matching.ts";

/**
 * Dubletten zusammenfassen — und zwar in linearer Zeit.
 *
 * ── Warum die Laufzeit hier geprüft wird ──────────────────────
 *
 * Die erste Fassung suchte für jede gefundene Dublette den Platz der
 * bisherigen mit `raus.indexOf(...)`. Das ist eine Suche von vorn, je
 * Dublette, also quadratischer Aufwand: zehnmal so viele Stellen sind
 * hundertmal so viel Arbeit.
 *
 * Bei ein paar hundert Anzeigen fällt das nie auf. Beim Ausbau des
 * Bestands von 2.506 auf fünfstellig wäre es zur Bremse geworden, und
 * niemand hätte den Zusammenhang zu dieser Zeile hergestellt.
 *
 * Ein Zeittest dazu stand hier und ist wieder verschwunden — warum,
 * steht weiter unten. Geprüft wird jetzt das Verhalten: dass die
 * bessere Fassung gewinnt und die Reihenfolge stimmt. Beides würde
 * brechen, wenn jemand die Platzverwaltung falsch umbaut.
 */

/**
 * Eine Stelle — wahlweise „besser" als ihre Vorgängerin.
 *
 * `besser` ist der Schalter, auf den es ankommt: Nur wenn eine
 * spätere Dublette die frühere schlägt, muss die Funktion deren Platz
 * in der Ausgabe finden. Genau dort sass die Suche von vorn. Mit
 * lauter gleichwertigen Dubletten liefe der teure Zweig nie, und der
 * Test wäre grün, ohne etwas zu prüfen.
 */
function job(i: number, schluessel: number, besser = false): ScoredJob {
  return {
    jobId: `j${i}`,
    job: {
      id: `j${i}`,
      title: `Disponent ${schluessel}`,
      companyName: `Firma ${schluessel}`,
      location: "Hamburg",
      salary: besser
        ? { min: 40000, max: 50000, currency: "EUR", period: "year", disclosed: true }
        : { min: null, max: null, currency: "EUR", period: "year", disclosed: false },
      weeklyHours: besser ? 40 : null,
      description: "Text",
    },
  } as unknown as ScoredJob;
}

describe("Zusammenfassen", () => {
  it("behält die bessere Fassung einer Dublette", () => {
    // Vier Punkte für ein Gehalt, zwei für die Wochenstunden: Die
    // zweite Zeile ist die vollständigere und muss gewinnen.
    const raus = entdoppeln([job(1, 1), job(2, 1, true)]);
    expect(raus).toHaveLength(1);
    expect(raus[0]!.job.salary.min).toBe(40000);
  });

  it("behält je Schlüssel genau eine Stelle", () => {
    const liste = [job(1, 1), job(2, 1), job(3, 2)];
    expect(entdoppeln(liste)).toHaveLength(2);
  });

  it("behält die Reihenfolge des ersten Auftretens", () => {
    const liste = [job(1, 1), job(2, 2), job(3, 1)];
    expect(entdoppeln(liste).map((x) => x.job.title)).toEqual(["Disponent 1", "Disponent 2"]);
  });

  /*
   * ── Warum hier KEIN Zeittest steht ────────────────────────
   *
   * Es stand einer da. Er sollte den Rückfall auf `raus.indexOf(...)`
   * fangen — eine Suche von vorn je Dublette, also quadratischer
   * Aufwand.
   *
   * Gemessen im direkten Vergleich beider Fassungen: bei 10.000
   * Stellen 1,5 ms linear gegen 7,9 ms mit Suche. Ein realer
   * Unterschied, aber in einer Grössenordnung, in der die Kosten der
   * Testdaten selbst — Objekte bauen, Felder lesen — grösser sind als
   * das, was gemessen werden soll. Der Test blieb deshalb grün, egal
   * welche Fassung darunter lag.
   *
   * Ein Test, der beide Fassungen besteht, prüft nichts und
   * behauptet doch etwas. Er ist schlimmer als keiner, weil er die
   * Frage als beantwortet aussehen lässt.
   *
   * Die lineare Fassung bleibt trotzdem: Sie ist nicht komplizierter,
   * und der Bestand soll wachsen. Nur ist sie eine Vorsichtsmassnahme
   * und keine gemessene Verbesserung — und so steht es auch im
   * Bericht.
   */
});
