import { describe, expect, it } from "vitest";
import {
  darfVersuchen,
  MAX_VERSUCHE,
  wartezeitSekunden,
} from "./analyse-warteschlange.ts";

describe("darfVersuchen", () => {
  it("lässt die ersten Versuche zu", () => {
    expect(darfVersuchen(1)).toBe(true);
    expect(darfVersuchen(MAX_VERSUCHE)).toBe(true);
  });

  it("gibt nach der Grenze auf", () => {
    /*
     * Ohne Grenze läuft ein Auftrag, der an einem kaputten Datensatz
     * scheitert, für immer im Kreis und verbraucht bei jedem Durchlauf
     * einen Platz.
     */
    expect(darfVersuchen(MAX_VERSUCHE + 1)).toBe(false);
  });
});

describe("wartezeitSekunden", () => {
  it("wächst exponentiell", () => {
    expect(wartezeitSekunden(1, 0)).toBeLessThan(wartezeitSekunden(3, 0));
  });

  it("streut nach unten", () => {
    /*
     * Ohne Streuung versuchen alle fehlgeschlagenen Aufträge
     * gleichzeitig erneut — und erzeugen genau die Last, an der sie
     * gescheitert sind.
     */
    expect(wartezeitSekunden(3, 1)).toBeLessThan(wartezeitSekunden(3, 0));
  });

  it("streut nicht nach oben über die Obergrenze", () => {
    expect(wartezeitSekunden(20, 0)).toBe(900);
    expect(wartezeitSekunden(20, 1)).toBeLessThanOrEqual(900);
  });

  it("bleibt auch bei vielen Versuchen endlich", () => {
    expect(wartezeitSekunden(50, 0.5)).toBeLessThanOrEqual(900);
  });
});
