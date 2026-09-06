import { describe, expect, it } from "vitest";
import { offeneErkenntnisse } from "./erkenntnisse.ts";

/**
 * Die Regel, an der sich entscheidet, ob eine weggeklickte Erkenntnis
 * wiederkommt.
 *
 * Der gemeldete Fehler lautete: „Abgelehnte oder geschlossene
 * Erkenntnisse erscheinen erneut." Er hatte zwei Ursachen, und beide
 * stehen hier als Prüfung — sonst kommt der Fehler mit der nächsten
 * Umstellung zurück, ohne dass es jemand merkt.
 */

let n = 0;
function vermutung(statement: string, over: Partial<{ userConfirmed: boolean; userRejected: boolean; dismissedAt: Date | null }> = {}) {
  return {
    id: `e${++n}`,
    statement,
    userConfirmed: false,
    userRejected: false,
    dismissedAt: null,
    ...over,
  };
}

describe("Offene Erkenntnisse", () => {
  it("zeigt, was noch niemand beurteilt hat", () => {
    const offen = offeneErkenntnisse([
      vermutung("Du hast Erfahrung in der Disposition"),
      vermutung("Du arbeitest gern im Team"),
    ]);
    expect(offen).toHaveLength(2);
  });

  it("blendet Bestätigtes, Abgelehntes und Weggelegtes aus", () => {
    const offen = offeneErkenntnisse([
      vermutung("bestätigt", { userConfirmed: true }),
      vermutung("abgelehnt", { userRejected: true }),
      vermutung("weggelegt", { dismissedAt: new Date("2026-08-31") }),
      vermutung("offen"),
    ]);
    expect(offen.map((o) => o.statement)).toEqual(["offen"]);
  });

  it("lässt denselben Satz nicht unter neuer Kennung zurückkommen", () => {
    /*
     * Die eigentliche Reparatur.
     *
     * Nina leitet dieselbe Vermutung aus der nächsten Nachricht erneut
     * ab: neue Zeile, neue Kennung, minimal andere Schreibweise. Weil
     * die Ablehnung vorher an der Kennung hing, war die neue Zeile
     * unbelastet — und die Fläche kam zurück.
     */
    const offen = offeneErkenntnisse([
      vermutung("Du hast Erfahrung in der Disposition", { userRejected: true }),
      vermutung("Du hast Erfahrung in der Disposition."),
      vermutung("du hast erfahrung in der disposition"),
    ]);
    expect(offen).toEqual([]);
  });

  it("gilt auch für Weggelegtes, nicht nur für Abgelehntes", () => {
    const offen = offeneErkenntnisse([
      vermutung("Du willst weniger körperlich arbeiten", { dismissedAt: new Date("2026-08-31") }),
      vermutung("Du willst weniger körperlich arbeiten!"),
    ]);
    expect(offen).toEqual([]);
  });

  it("unterdrückt keine WIRKLICH neue Vermutung", () => {
    /*
     * Die Gegenrichtung, und der gefährlichere Fehler: eine Erkenntnis
     * stillschweigend zu verschlucken, die noch niemand gesehen hat.
     * Wer sie nie sieht, kann sie auch nicht vermissen — das fällt
     * niemandem auf.
     */
    const offen = offeneErkenntnisse([
      vermutung("Du hast Erfahrung in der Disposition", { userRejected: true }),
      vermutung("Du hast Erfahrung in der Logistik"),
      vermutung("Du hast KEINE Erfahrung in der Disposition"),
    ]);
    expect(offen.map((o) => o.statement)).toEqual([
      "Du hast Erfahrung in der Logistik",
      "Du hast KEINE Erfahrung in der Disposition",
    ]);
  });

  it("kommt mit einer leeren Liste zurecht", () => {
    expect(offeneErkenntnisse([])).toEqual([]);
  });
});
