import { describe, expect, it } from "vitest";
import { MIN_FUER_AUSSAGE } from "./ergebnisse.ts";

/**
 * Was am Outcome Loop ohne Datenbank prüfbar ist.
 *
 * Das Wichtigste an dieser Auswertung ist, wann sie schweigt. Eine
 * Interviewquote aus vier Bewerbungen springt um 25 Prozentpunkte,
 * sobald ein einziger Fall anders ausgeht — und sähe trotzdem aus wie
 * eine Zahl, auf die man sich verlassen kann.
 */
describe("Die Schwelle", () => {
  it("liegt hoch genug, dass eine Quote nicht am Einzelfall hängt", () => {
    /*
     * Bei 20 Fällen verschiebt ein einzelner die Quote um 5
     * Prozentpunkte. Bei 5 Fällen wären es 20 — mehr als der
     * Unterschied, den man messen will.
     */
    expect(MIN_FUER_AUSSAGE).toBeGreaterThanOrEqual(20);
    const verschiebungBeiEinemFall = 1 / MIN_FUER_AUSSAGE;
    expect(verschiebungBeiEinemFall).toBeLessThanOrEqual(0.05);
  });
});
