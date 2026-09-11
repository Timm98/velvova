import { describe, expect, it } from "vitest";
import { messen } from "./messen.ts";

/**
 * Das Gold-Set als Regressionsgrenze.
 *
 * ── Warum hier Grenzen stehen und keine Gleichheit ──────────────
 *
 * Die Referenz ist eine Stichprobe von 120 Einträgen aus 100 realen
 * Anzeigen, von mir Zeile für Zeile geprüft. Sie ist kein
 * Goldstandard im strengen Sinn — ein Dritter hat sie nicht
 * gegengelesen, und das gehört zu jeder Zahl dazu, die daraus
 * entsteht.
 *
 * Was sie leistet: Sie hält fest, dass eine Änderung an den Regeln
 * die Sache nicht schlechter macht. Die wichtigste Grenze ist die
 * unterste — eine Bitte, die zur Pflicht wird, hält jemanden von
 * einer Bewerbung ab, und dieser Fehler ist teurer als jeder andere
 * in dieser Datei.
 */
describe("Gold-Set", () => {
  const m = messen();

  it("liest die Referenz überhaupt", () => {
    expect(m.stichprobe).toBe(120);
  });

  it("erzeugt höchstens ein Fünftel überflüssige Einträge", () => {
    expect(m.ueberfluessig / m.stichprobe).toBeLessThanOrEqual(0.2);
  });

  it("trifft die Kategorie bei mindestens neun von zehn", () => {
    const gueltig = m.stichprobe - m.ueberfluessig;
    expect(m.kategorieRichtig / gueltig).toBeGreaterThanOrEqual(0.9);
  });

  it("trifft die Verbindlichkeit bei mindestens fünfundneunzig von hundert", () => {
    const gueltig = m.stichprobe - m.ueberfluessig;
    expect(m.verbindlichkeitRichtig / gueltig).toBeGreaterThanOrEqual(0.95);
  });

  it("macht aus höchstens zwei von hundert Zeilen eine erfundene Pflicht", () => {
    expect(m.falscheMuss / m.stichprobe).toBeLessThanOrEqual(0.02);
  });
});
