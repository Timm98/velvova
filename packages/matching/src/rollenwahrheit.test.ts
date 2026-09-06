import { describe, expect, it } from "vitest";
import { MIN_STIMMEN, kartenGuete, rollenwahrheit } from "./rollenwahrheit.ts";

/**
 * Die Role Truth Card — und warum nicht gemittelt wird.
 *
 * Der naheliegende Weg wäre, Arbeitgeberangabe und Mitarbeiterantworten
 * zu gewichten und einen Wert auszugeben. Das Ergebnis wäre glatter und
 * wertloser: Der Widerspruch ist die Auskunft, die man sonst nirgends
 * bekommt, und ein Mittelwert löscht ihn.
 */

const abgeleitet = [
  { dimension: "belastung" as const, wert: 0.4, sicherheit: 0.5, beleg: "„belastbar\"" },
];

describe("Die Stufen der Herkunft", () => {
  it("lässt die Arbeitgeberangabe die Textableitung schlagen", () => {
    const r = rollenwahrheit({
      arbeitgeber: [{ dimension: "belastung", wert: 0.8, begruendung: "Notfalldienst" }],
      bestaetigungen: [],
      abgeleitet,
    });
    expect(r[0]!.herkunft).toBe("arbeitgeber");
    expect(r[0]!.wert).toBe(0.8);
  });

  it("lässt Bestätigungen die Arbeitgeberangabe schlagen", () => {
    const r = rollenwahrheit({
      arbeitgeber: [{ dimension: "belastung", wert: 0.8, begruendung: "" }],
      bestaetigungen: [0.7, 0.75, 0.8].map((wert) => ({ dimension: "belastung" as const, wert })),
      abgeleitet,
    });
    expect(r[0]!.herkunft).toBe("bestaetigt");
    expect(r[0]!.stimmen).toBe(3);
  });
});

describe("Eine einzelne Stimme ist keine Bestätigung", () => {
  it("bleibt unter der Schwelle bei der Arbeitgeberangabe", () => {
    /*
     * Eine einzelne Rückmeldung kann alles sein — ein schlechter Tag,
     * eine offene Rechnung. Sie als „bestätigt" auszugeben wäre eine
     * Behauptung über die Rolle auf Basis einer Person.
     */
    const r = rollenwahrheit({
      arbeitgeber: [{ dimension: "belastung", wert: 0.3, begruendung: "" }],
      bestaetigungen: [{ dimension: "belastung", wert: 0.95 }],
      abgeleitet: [],
    });
    expect(MIN_STIMMEN).toBeGreaterThanOrEqual(3);
    expect(r[0]!.herkunft).toBe("arbeitgeber");
    expect(r[0]!.wert).toBe(0.3);
  });
});

describe("Der Widerspruch überlebt", () => {
  it("wird benannt statt weggemittelt", () => {
    /*
     * Der Arbeitgeber sagt „wenig Druck", sechs Mitarbeiter sagen „viel
     * Druck". Ein Mittelwert sagte „mittel" — und die einzige
     * Information, die zählt, wäre weg.
     */
    const r = rollenwahrheit({
      arbeitgeber: [{ dimension: "belastung", wert: 0.2, begruendung: "geregelte Zeiten" }],
      bestaetigungen: [0.8, 0.85, 0.9, 0.75, 0.8, 0.95].map((wert) => ({
        dimension: "belastung" as const,
        wert,
      })),
      abgeleitet: [],
    });
    expect(r[0]!.widerspruch).toBe(true);
    expect(r[0]!.wert).toBeGreaterThan(0.7);
    expect(r[0]!.beleg).toContain("anders als der Arbeitgeber");
  });

  it("steht ganz oben", () => {
    const r = rollenwahrheit({
      arbeitgeber: [
        { dimension: "autonomie", wert: 0.9, begruendung: "" },
        { dimension: "belastung", wert: 0.2, begruendung: "" },
      ],
      bestaetigungen: [
        ...[0.9, 0.85, 0.9].map((wert) => ({ dimension: "autonomie" as const, wert })),
        ...[0.9, 0.85, 0.9].map((wert) => ({ dimension: "belastung" as const, wert })),
      ],
      abgeleitet: [],
    });
    expect(r[0]!.dimension).toBe("belastung");
    expect(kartenGuete(r)).toEqual({ achsen: 2, bestaetigt: 2, widersprueche: 1 });
  });
});

describe("Der Median gegen den Ausreisser", () => {
  it("lässt eine extreme Antwort die Achse nicht verschieben", () => {
    const r = rollenwahrheit({
      arbeitgeber: [],
      bestaetigungen: [0.5, 0.5, 0.5, 0.5, 1.0].map((wert) => ({
        dimension: "tempo" as const,
        wert,
      })),
      abgeleitet: [],
    });
    // Mittelwert wäre 0,6 — der Median bleibt bei 0,5.
    expect(r[0]!.wert).toBe(0.5);
  });
});
