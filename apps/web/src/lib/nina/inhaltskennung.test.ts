import { describe, expect, it } from "vitest";
import { inhaltskennung } from "./inhaltskennung.ts";

/**
 * Der Hash entscheidet, ob eine abgelehnte Erkenntnis wiederkommt.
 *
 * Zu grosszügig, und die Person sieht Vermutungen nie, die sie noch
 * nicht beurteilt hat. Zu streng, und die abgelehnte Aussage steht beim
 * nächsten Satz wieder da — genau der Fehler, der repariert werden
 * sollte. Beide Richtungen stehen hier.
 */
describe("Inhaltskennung", () => {
  it("erkennt denselben Satz in anderer Schreibweise wieder", () => {
    const a = inhaltskennung("Du hast Erfahrung in der Disposition.");
    for (const variante of [
      "du hast erfahrung in der disposition",
      "Du hast Erfahrung in der Disposition",
      "  Du   hast Erfahrung in der Disposition!  ",
      "Du hast Erfahrung in der Disposition …",
    ]) {
      expect(inhaltskennung(variante), variante).toBe(a);
    }
  });

  it("hält zwei verschiedene Aussagen auseinander", () => {
    // Der gefährlichere Fehler: eine neue Vermutung stillschweigend
    // unterdrücken, weil sie einer alten ähnelt.
    const a = inhaltskennung("Du hast Erfahrung in der Disposition.");
    const b = inhaltskennung("Du hast Erfahrung in der Logistik.");
    expect(a).not.toBe(b);
  });

  it("behält Umlaute — sie unterscheiden Wörter", () => {
    expect(inhaltskennung("Führerschein")).not.toBe(inhaltskennung("Fuhrerschein"));
  });

  it("unterscheidet Verneinung von Behauptung", () => {
    // „Du arbeitest gern im Team" und „Du arbeitest nicht gern im Team"
    // dürfen nie denselben Hash haben. Sonst löscht eine Ablehnung der
    // einen die andere gleich mit.
    expect(inhaltskennung("Du arbeitest gern im Team")).not.toBe(
      inhaltskennung("Du arbeitest nicht gern im Team"),
    );
  });

  it("ist stabil — derselbe Text ergibt immer denselben Wert", () => {
    const t = "Du willst raus aus der körperlichen Arbeit.";
    expect(inhaltskennung(t)).toBe(inhaltskennung(t));
    expect(inhaltskennung(t)).toMatch(/^[0-9a-f]{32}$/);
  });

  it("stimmt mit der SQL-Normalisierung aus Migration 0019 überein", () => {
    /*
     * Zwei Implementierungen derselben Regel — hier und in SQL. Sie
     * müssen dieselbe Zeichenkette hashen, sonst passt der nachgezogene
     * Bestand nicht zu neu berechneten Werten, und alte Ablehnungen
     * greifen nicht mehr.
     *
     * Nachgebildet wird hier die SQL-Seite; die Gleichheit der
     * Ergebnisse ist die Aussage.
     */
    const wieSql = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^0-9a-zäöüß ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    for (const t of [
      "Du hast Erfahrung in der Disposition.",
      "Führerschein C1 vorhanden!",
      "Mindestens 3.000 € brutto",
    ]) {
      const wieJs = t
        .toLowerCase()
        .replace(/[^\p{L}\p{N} ]+/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
      expect(wieJs, t).toBe(wieSql(t));
    }
  });
});
