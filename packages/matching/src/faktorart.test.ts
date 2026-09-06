import { describe, expect, it } from "vitest";
import { blockiert, einstufen } from "./faktorart.ts";

const f = (over: Partial<{ key: string; raw: number | null; weight: number }> = {}) => ({
  key: "gehalt",
  raw: 0.5,
  weight: 0.2,
  ...over,
});

describe("einstufen", () => {
  it("nennt einen unbekannten Wert fehlende Angabe, nicht Konflikt", () => {
    // Eine Stelle ohne Gehaltsangabe ist nicht schlecht bezahlt.
    expect(einstufen(f({ raw: null }))).toEqual({ art: "fehlende_angabe", schwere: null });
  });

  it("stuft gute Erfüllung als positiv ein", () => {
    expect(einstufen(f({ raw: 0.8 })).art).toBe("positiv");
  });

  it("gibt positiven Faktoren keine Schwere", () => {
    expect(einstufen(f({ raw: 0.9 })).schwere).toBeNull();
  });

  it("blockt eine harte Bedingung schon bei knapper Verfehlung", () => {
    // 0.65 wäre bei einer weichen Präferenz nur neutral.
    expect(einstufen(f({ raw: 0.65 }), true)).toEqual({ art: "blocker", schwere: 2 });
  });

  it("blockt schwerer, je weiter die harte Bedingung verfehlt ist", () => {
    expect(einstufen(f({ raw: 0.1 }), true).schwere).toBe(3);
  });

  it("blockt bei bekannten harten Faktoren auch ohne Nutzerangabe", () => {
    expect(einstufen(f({ key: "arbeitserlaubnis", raw: 0.2 })).art).toBe("blocker");
  });

  it("meldet einen schwachen, wichtigen Faktor als Konflikt", () => {
    expect(einstufen(f({ raw: 0.2, weight: 0.35 }))).toEqual({ art: "konflikt", schwere: 2 });
  });

  it("schweigt zu einem schwachen, unwichtigen Faktor", () => {
    // Sonst füllt sich die Einwandliste mit Fussnoten.
    expect(einstufen(f({ raw: 0.1, weight: 0.05 })).art).toBe("neutral");
  });

  it("nennt mittlere Erfüllung neutral, nicht Konflikt", () => {
    expect(einstufen(f({ raw: 0.55, weight: 0.4 })).art).toBe("neutral");
  });

  it("behandelt dieselbe Zahl je nach Härte verschieden", () => {
    const zahl = f({ raw: 0.3, weight: 0.2 });
    expect(einstufen(zahl, false).art).toBe("konflikt");
    expect(einstufen(zahl, true).art).toBe("blocker");
  });
});

describe("blockiert", () => {
  it("lässt eine Stelle mit lauter Abstrichen durch", () => {
    const e = [einstufen(f({ raw: 0.2, weight: 0.4 })), einstufen(f({ raw: 0.3, weight: 0.2 }))];
    expect(blockiert(e)).toBe(false);
  });

  it("schliesst eine Stelle bei einem echten Blocker aus", () => {
    expect(blockiert([einstufen(f({ raw: 0.1 }), true)])).toBe(true);
  });

  it("ist bei einer leeren Liste nicht blockiert", () => {
    // Keine Faktoren heisst nichts geprüft, nicht alles verletzt.
    expect(blockiert([])).toBe(false);
  });
});
