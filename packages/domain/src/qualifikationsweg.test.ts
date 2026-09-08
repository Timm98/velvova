import { describe, expect, it } from "vitest";
import { forderungPruefen, type Qualifikationsforderung } from "./qualifikationsweg.ts";

const metallbauer: Qualifikationsforderung = {
  text: "Qualifikation",
  verknuepfung: "oder",
  wege: [
    { schluessel: "ausbildung", text: "abgeschlossene Ausbildung" },
    { schluessel: "erfahrung", text: "einschlägige Berufserfahrung" },
  ],
};

describe("Qualifikationswege (Prüffall B05)", () => {
  it("lässt einen von mehreren Wegen genügen", () => {
    const b = forderungPruefen(metallbauer, [
      { weg: metallbauer.wege[0]!, stand: "widerlegt" },
      { weg: metallbauer.wege[1]!, stand: "belegt" },
    ]);
    expect(b.ergebnis).toBe("erfuellt");
    expect(b.belegteWege).toEqual(["erfahrung"]);
  });

  it("macht aus einem Oder kein Und", () => {
    /*
     * Der Fehler, der Menschen aussortiert: Wer die Wege als Liste von
     * Anforderungen liest, verlangt sie alle — und eine Person mit zehn
     * Jahren Erfahrung erfährt, dass ihr die Ausbildung fehlt.
     */
    const b = forderungPruefen(metallbauer, [
      { weg: metallbauer.wege[1]!, stand: "belegt" },
    ]);
    expect(b.ergebnis).toBe("erfuellt");
  });

  it("wertet eine Profillücke nicht als fehlende Fähigkeit", () => {
    /*
     * Steht im Profil nichts über eine Ausbildung, heisst das nicht,
     * dass keine da ist — es heisst, dass niemand gefragt hat.
     */
    const b = forderungPruefen(metallbauer, []);
    expect(b.ergebnis).toBe("ungeprueft");
    expect(b.offeneWege).toEqual(["ausbildung", "erfahrung"]);
  });

  it("verneint erst, wenn jeder Weg widerlegt ist", () => {
    const b = forderungPruefen(metallbauer, [
      { weg: metallbauer.wege[0]!, stand: "widerlegt" },
      { weg: metallbauer.wege[1]!, stand: "widerlegt" },
    ]);
    expect(b.ergebnis).toBe("nicht_erfuellt");
  });

  it("bleibt offen, solange ein Weg ungeprüft ist", () => {
    const b = forderungPruefen(metallbauer, [
      { weg: metallbauer.wege[0]!, stand: "widerlegt" },
    ]);
    expect(b.ergebnis).toBe("ungeprueft");
    expect(b.satz).toContain("offen");
  });
});

describe("Wenn wirklich alles verlangt wird", () => {
  const und: Qualifikationsforderung = { ...metallbauer, verknuepfung: "und" };

  it("genügt ein widerlegter Punkt für ein Nein", () => {
    const b = forderungPruefen(und, [
      { weg: und.wege[0]!, stand: "belegt" },
      { weg: und.wege[1]!, stand: "widerlegt" },
    ]);
    expect(b.ergebnis).toBe("nicht_erfuellt");
  });

  it("verlangt für ein Ja, dass nichts offen ist", () => {
    const b = forderungPruefen(und, [{ weg: und.wege[0]!, stand: "belegt" }]);
    expect(b.ergebnis).toBe("ungeprueft");
  });
});
