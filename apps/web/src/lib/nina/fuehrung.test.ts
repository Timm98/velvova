import { describe, expect, it } from "vitest";
import { darfFuehren, FUEHRUNG_WARTEN_MS, type Fuehrungslage } from "./fuehrung.ts";

const bereit: Fuehrungslage = {
  schonGefuehrt: false,
  treffer: 3,
  schreibtGerade: false,
  feldinhalt: "",
};

describe("darfFuehren", () => {
  it("führt, sobald Treffer da sind und nichts dagegen spricht", () => {
    expect(darfFuehren(bereit)).toBe(true);
  });

  it("führt kein zweites Mal", () => {
    expect(darfFuehren({ ...bereit, schonGefuehrt: true })).toBe(false);
  });

  it("führt nicht ohne Treffer", () => {
    expect(darfFuehren({ ...bereit, treffer: 0 })).toBe(false);
  });

  it("führt nicht, während Monday schreibt", () => {
    expect(darfFuehren({ ...bereit, schreibtGerade: true })).toBe(false);
  });

  it("führt nicht, wenn jemand einen Text angefangen hat", () => {
    expect(darfFuehren({ ...bereit, feldinhalt: "ich suche etwas in " })).toBe(false);
  });

  /*
   * Der Fall, an dem die erste Fassung scheiterte: Das Eingabefeld
   * nimmt beim Laden den Fokus. Mit der Lesart „ein fokussiertes Feld
   * heisst, jemand schreibt" wäre die Führung nie ausgelöst worden.
   */
  it("führt trotz Fokus, solange das Feld leer ist", () => {
    expect(darfFuehren({ ...bereit, feldinhalt: "" })).toBe(true);
    expect(darfFuehren({ ...bereit, feldinhalt: "   " })).toBe(true);
  });

  it("führt, wenn gar kein Feld den Fokus hat", () => {
    expect(darfFuehren({ ...bereit, feldinhalt: null })).toBe(true);
  });

  it("wartet lange genug, dass man den Satz lesen kann", () => {
    expect(FUEHRUNG_WARTEN_MS).toBeGreaterThanOrEqual(1200);
    expect(FUEHRUNG_WARTEN_MS).toBeLessThanOrEqual(2500);
  });
});
