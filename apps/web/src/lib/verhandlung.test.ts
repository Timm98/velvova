import { describe, expect, it } from "vitest";
import { einordnen } from "./verhandlung.ts";

/**
 * Wo ein Angebot steht — und was ausdrücklich nicht gesagt wird.
 *
 * Diese Seite stützt eine Verhandlung mit einer Zahl, die man nennen
 * kann. Sie berechnet keine Forderung: Was durchsetzbar ist, hängt von
 * Markt, Person und Gespräch ab, und davon wissen wir nichts.
 */

describe("Die Einordnung folgt den Quartilen", () => {
  it("nennt ein Angebot unter dem unteren Quartil „darunter“", () => {
    expect(einordnen(40_000, 45_000, 60_000)).toBe("darunter");
  });

  it("nennt ein Angebot in der mittleren Hälfte „im_rahmen“", () => {
    expect(einordnen(52_000, 45_000, 60_000)).toBe("im_rahmen");
    /* Die Grenzen selbst gehören noch dazu. */
    expect(einordnen(45_000, 45_000, 60_000)).toBe("im_rahmen");
    expect(einordnen(60_000, 45_000, 60_000)).toBe("im_rahmen");
  });

  it("nennt ein Angebot über dem oberen Quartil „darueber“", () => {
    expect(einordnen(75_000, 45_000, 60_000)).toBe("darueber");
  });
});

describe("Was nicht bekannt ist, wird nicht behauptet", () => {
  it("ordnet ohne Angebot nichts ein", () => {
    expect(einordnen(null, 45_000, 60_000)).toBeNull();
  });

  it("ordnet ohne beide Quartile nichts ein", () => {
    /*
     * Sonst hiesse „wir kennen die Spanne nicht" dasselbe wie „das
     * Angebot ist normal" — und das wäre eine Behauptung über etwas,
     * das wir nicht wissen.
     */
    expect(einordnen(50_000, null, null)).toBeNull();
  });

  it("kommt mit einem einseitigen Quartil aus", () => {
    /*
     * Der Entgeltatlas weist für manche Berufsgattungen nur eine Seite
     * aus. Ein Angebot unter dem bekannten unteren Quartil ist
     * trotzdem darunter.
     */
    expect(einordnen(40_000, 45_000, null)).toBe("darunter");
    expect(einordnen(50_000, 45_000, null)).toBe("im_rahmen");
    expect(einordnen(80_000, null, 60_000)).toBe("darueber");
  });
});
