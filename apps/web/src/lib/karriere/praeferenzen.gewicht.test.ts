import { describe, expect, it } from "vitest";
import { gewichtAus } from "./praeferenzen";

describe("gewichtAus", () => {
  it("nimmt ein gesetztes Gewicht unverändert", () => {
    expect(gewichtAus({ konfidenz: 40, gewicht: 90 })).toBe(90);
  });

  it("leitet ein fehlendes Gewicht aus der Konfidenz ab", () => {
    expect(gewichtAus({ konfidenz: 100 })).toBe(80);
  });

  it("lässt eine schwach belegte Vorliebe schwach wiegen", () => {
    /*
     * Ohne diese Ableitung griffe der Schemavorgabewert 50 — eine
     * Vermutung mit 30 % Sicherheit wöge dann so schwer wie eine
     * ausdrückliche Angabe.
     */
    expect(gewichtAus({ konfidenz: 30 })).toBeLessThan(50);
  });

  it("hält auch eine sehr sichere Ableitung unter der ausdrücklichen Angabe", () => {
    expect(gewichtAus({ konfidenz: 85 })).toBeLessThan(85);
  });

  it("nimmt eine ausdrückliche Null ernst", () => {
    // `?? ` würde hier 0 verschlucken und 80 zurückgeben.
    expect(gewichtAus({ konfidenz: 100, gewicht: 0 })).toBe(0);
  });
});
