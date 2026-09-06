import { describe, expect, it } from "vitest";
import { musterErkennen, type Rueckmeldung } from "./musterregeln";

const r = (grund: string | null, n = 1): Rueckmeldung[] =>
  Array.from({ length: n }, () => ({ grund, erstelltAm: new Date(0) }));

describe("musterErkennen", () => {
  it("erkennt den Fall aus der Vorgabe", () => {
    /* Sieben von zehn Ablehnungen wegen Kundenkontakt — hier über den
       Grund „aufgaben", weil es der ist, der dafür vergeben wird. */
    const m = musterErkennen([...r("aufgaben", 7), ...r("gehalt", 3)]);
    expect(m?.grund).toBe("aufgaben");
    expect(m?.treffer).toBe(7);
    expect(m?.frage).toContain("Aufgaben");
  });

  it("schweigt bei zu wenigen Rückmeldungen", () => {
    expect(musterErkennen(r("gehalt", 4))).toBeNull();
  });

  it("schweigt bei zwei Treffern — das ist Zufall", () => {
    expect(musterErkennen([...r("gehalt", 2), ...r("standort", 2), ...r("remote", 2)]))
      .toBeNull();
  });

  it("schweigt, wenn kein Grund die Hälfte erreicht", () => {
    expect(musterErkennen([...r("gehalt", 3), ...r("standort", 3), ...r("remote", 3)]))
      .toBeNull();
  });

  it("zählt „sonstiges“ nicht mit", () => {
    /* „Sonstiges" sagt nichts darüber, was jemand nicht will. */
    expect(musterErkennen([...r("sonstiges", 8), ...r("gehalt", 2)])).toBeNull();
  });

  it("ignoriert Rückmeldungen ohne Grund", () => {
    expect(musterErkennen([...r(null, 8), ...r("gehalt", 2)])).toBeNull();
  });

  it("gibt nur das stärkste Muster zurück", () => {
    const m = musterErkennen([...r("gehalt", 6), ...r("remote", 4)]);
    expect(m?.grund).toBe("gehalt");
  });

  it("liefert zu jedem Muster eine ausformulierte Frage", () => {
    for (const g of ["gehalt", "standort", "remote", "aufgaben", "branche"]) {
      const m = musterErkennen(r(g, 6));
      expect(m?.frage.length ?? 0).toBeGreaterThan(30);
      expect(m?.frage).toContain("?");
    }
  });

  it("stellt eine Frage und trifft keine Entscheidung", () => {
    /* Der ganze Zweck: Aus dem Muster folgt nichts ausser einer
       Frage. Gäbe es hier ein Feld „regel" oder „filter", wäre die
       Entscheidung schon gefallen. */
    const m = musterErkennen(r("branche", 6));
    expect(Object.keys(m ?? {})).toEqual(["grund", "treffer", "gesamt", "anteil", "frage"]);
  });
});
