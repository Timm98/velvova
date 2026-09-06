import { describe, expect, it } from "vitest";
import { passungsgruende, vorlaeufigkeit } from "./passungsgruende.ts";
import type { ScoreFactor } from "./scoring.ts";

function f(over: Partial<ScoreFactor>): ScoreFactor {
  return {
    key: "k", label: "Achse", raw: 0.5, weight: 0.2,
    contribution: 0.1, explanation: "Ein Satz.", evidenceIds: [],
    ...over,
  };
}

describe("passungsgruende", () => {
  it("trennt dafür, dagegen und ungeklärt", () => {
    const g = passungsgruende([
      f({ key: "a", raw: 0.9 }),
      f({ key: "b", raw: 0.1 }),
      f({ key: "c", raw: null }),
    ]);
    expect(g.dafuer.map((x) => x.key)).toEqual(["a"]);
    expect(g.dagegen.map((x) => x.key)).toEqual(["b"]);
    expect(g.offen.map((x) => x.key)).toEqual(["c"]);
  });

  it("wirft Unbekanntes nicht zu Dagegen", () => {
    /*
     * Eine Achse ohne Daten ist nicht schlecht, sondern unbekannt.
     * Beides zusammenzuwerfen wäre derselbe Fehler, den die Gewichtung
     * vermeidet: „keine Angabe zu Überstunden" heisst nicht „keine
     * Überstunden".
     */
    const g = passungsgruende([f({ raw: null })]);
    expect(g.dagegen).toHaveLength(0);
    expect(g.offen).toHaveLength(1);
  });

  it("schweigt über den Mittelbereich", () => {
    /*
     * Eine Achse, die weder deutlich dafür noch dagegen spricht, ist
     * keine Auskunft. Sie in eine der Listen zu setzen hiesse, ihr eine
     * Bedeutung zu geben, die sie nicht hat.
     */
    const g = passungsgruende([f({ raw: 0.5 }), f({ raw: 0.6 }), f({ raw: 0.4 })]);
    expect(g.dafuer).toHaveLength(0);
    expect(g.dagegen).toHaveLength(0);
    expect(g.offen).toHaveLength(0);
  });

  it("sortiert nach Gewicht, nicht nach Ausschlag", () => {
    /*
     * Die wichtigste Achse gehört nach oben, auch wenn eine
     * unwichtigere extremer ausschlägt.
     */
    const g = passungsgruende([
      f({ key: "klein", raw: 1, weight: 0.05 }),
      f({ key: "gross", raw: 0.7, weight: 0.4 }),
    ]);
    expect(g.dafuer.map((x) => x.key)).toEqual(["gross", "klein"]);
  });

  it("nimmt den Satz des Faktors, ohne ihn umzuschreiben", () => {
    const g = passungsgruende([f({ raw: 0.9, explanation: "Drei belegte Fähigkeiten passen." })]);
    expect(g.dafuer[0]!.satz).toBe("Drei belegte Fähigkeiten passen.");
  });
});

describe("vorlaeufigkeit", () => {
  it("schweigt, wenn nichts offen ist", () => {
    /* Ein beruhigender Satz ohne Anlass wäre Füllmaterial. */
    expect(vorlaeufigkeit({ dafuer: [], dagegen: [], offen: [] })).toBeNull();
  });

  it("nennt die Zahl der fehlenden Angaben", () => {
    /*
     * „Datensicherheit: mittel" ist eine Einstufung, mit der niemand
     * etwas anfangen kann. Die Zahl sagt, was zu tun wäre.
     */
    const g = passungsgruende([f({ raw: null }), f({ raw: null }), f({ raw: null })]);
    expect(vorlaeufigkeit(g)).toContain("drei Angaben");
  });

  it("beugt bei einer einzigen Angabe richtig", () => {
    const g = passungsgruende([f({ raw: null })]);
    expect(vorlaeufigkeit(g)).toContain("fehlt noch eine Angabe");
  });
});
