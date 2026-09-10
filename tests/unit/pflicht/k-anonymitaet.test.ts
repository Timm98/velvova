import { describe, expect, it } from "vitest";
import { MINDESTZAHL_STILL, stillerMarktSatz } from "../../../packages/domain/src/nachtlauf.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Pflichttest: Zähler verraten niemanden
 * ══════════════════════════════════════════════════════════════════
 *
 * Ein Arbeitgeber darf erfahren, wie viele Menschen über seiner Linie
 * liegen — aber erst ab einer Gruppe, in der niemand erkennbar ist.
 * „Zwei Pflegefachkräfte in diesem Stadtteil über 4.000 Euro" ist
 * keine Statistik, sondern ein Hinweis darauf, wer gemeint ist.
 *
 * Dieselbe Grenze gilt in die andere Richtung: Was ein Mensch über
 * die Angebote erfährt, die über seiner Linie liegen, darf ihm nicht
 * verraten, welcher Betrieb sie hinterlegt hat.
 */

describe("Pflichttest: k-Anonymität", () => {
  it("hält die Mindestgruppe bei mindestens fünf", () => {
    expect(MINDESTZAHL_STILL).toBeGreaterThanOrEqual(5);
  });

  it("nennt unterhalb der Grenze keine Zahl", () => {
    for (let n = 1; n < MINDESTZAHL_STILL; n++) {
      expect(stillerMarktSatz(n), `n=${n}`).not.toMatch(/\d/);
    }
  });

  it("nennt ab der Grenze die Zahl", () => {
    expect(stillerMarktSatz(MINDESTZAHL_STILL)).toContain(String(MINDESTZAHL_STILL));
  });

  it("sagt bei null, dass nichts da ist — ohne eine Zahl zu nennen", () => {
    /*
     * „0 Angebote" wäre selbst eine Auskunft: Wer sie an zwei Tagen
     * vergleicht, sieht, wann etwas dazugekommen ist.
     */
    expect(stillerMarktSatz(0)).not.toMatch(/\d/);
  });
});
