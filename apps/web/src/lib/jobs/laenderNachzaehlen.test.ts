import { describe, expect, it } from "vitest";
import { LAENDER_JE_LAUF, takterVersatz } from "./laenderNachzaehlen.ts";

describe("Rotation der Länderzählung", () => {
  it("springt um die Zahl der Länder je Lauf weiter", () => {
    /*
     * Ein Zeiger, der um eins wandert, lässt aufeinanderfolgende Läufe
     * zu drei Vierteln dasselbe zählen — und ein Land käme erst nach
     * vier Stunden wieder dran statt nach der Runde.
     */
    expect(takterVersatz(0, 22)).toBe(0);
    expect(takterVersatz(1, 22)).toBe(LAENDER_JE_LAUF);
    expect(takterVersatz(2, 22)).toBe(2 * LAENDER_JE_LAUF);
  });

  it("läuft um, statt über das Ende hinauszuzeigen", () => {
    expect(takterVersatz(6, 22)).toBe((6 * LAENDER_JE_LAUF) % 22);
    expect(takterVersatz(1000, 22)).toBeLessThan(22);
    expect(takterVersatz(1000, 22)).toBeGreaterThanOrEqual(0);
  });

  it("bleibt auch bei einem negativen Takt im gültigen Bereich", () => {
    /*
     * `takt` kommt aus `Math.floor(Date.now() / stunde)` und ist
     * praktisch nie negativ. Ein Modulo, das bei einem negativen Wert
     * eine negative Zahl liefert, ergäbe hier aber einen Zugriff
     * ausserhalb der Liste — und das fiele erst im Betrieb auf.
     */
    expect(takterVersatz(-1, 22)).toBeGreaterThanOrEqual(0);
    expect(takterVersatz(-7, 22)).toBeLessThan(22);
  });

  it("kommt mit einer leeren Länderliste zurecht", () => {
    expect(takterVersatz(5, 0)).toBe(0);
  });

  it("erreicht über mehrere Läufe jedes Land", () => {
    const anzahl = 22;
    const gesehen = new Set<number>();
    for (let takt = 0; takt < 20; takt++) {
      const v = takterVersatz(takt, anzahl);
      for (let n = 0; n < LAENDER_JE_LAUF; n++) gesehen.add((v + n) % anzahl);
    }
    expect(gesehen.size).toBe(anzahl);
  });
});
