import { describe, expect, it } from "vitest";
import { type Achsenangabe, vergleichen } from "./dimensionsvergleich.ts";

const wegBekannt: Achsenangabe = {
  achse: "arbeitsweg",
  bezug: "45 Minuten, 5 Tage",
  kandidat: "25 Minuten, 5 Tage",
  gleicheGrundlage: true,
};
const geldOhneHeute: Achsenangabe = {
  achse: "geld",
  bezug: null,
  kandidat: "48.000 fest",
  gleicheGrundlage: false,
};

describe("Dimensionsvergleich (Prüffall B09)", () => {
  it("prüft den Weg auch ohne heutiges Einkommen", () => {
    /*
     * Wer sein heutiges Netto nicht kennt, kann trotzdem wissen wollen,
     * ob der Weg kürzer wird. Ein Vergleich, der auf die fehlende Zahl
     * wartet, hilft ihm nicht — einer, der sie schätzt, noch weniger.
     */
    const r = vergleichen("a_gegen_heute", [wegBekannt, geldOhneHeute]);
    expect(r.vergleichbare).toEqual(["arbeitsweg"]);
    expect(r.offene).toEqual(["geld"]);
    expect(r.verbesserungAussagbar).toBe(true);
  });

  it("erfindet für die fehlende Seite keinen Wert", () => {
    const r = vergleichen("a_gegen_heute", [geldOhneHeute]);
    expect(r.befunde[0]?.stand).toBe("offen");
    expect(r.befunde[0]?.satz).toContain("fehlt die Angabe");
  });

  it("vergleicht nicht über verschiedene Grundlagen", () => {
    const r = vergleichen("b_gegen_a", [
      { achse: "geld", bezug: "60.000 im Jahr", kandidat: "3.000 im Monat netto", gleicheGrundlage: false },
    ]);
    expect(r.befunde[0]?.stand).toBe("offen");
    expect(r.befunde[0]?.satz).toContain("derselben Grundlage");
  });

  it("behauptet im Einzelcheck keine Verbesserung", () => {
    /*
     * Ohne Bezugspunkt gibt es keine. Das passiert, wenn die drei Modi
     * im Code denselben Weg nehmen und sich nur in der Überschrift
     * unterscheiden.
     */
    const r = vergleichen("einzelcheck", [wegBekannt]);
    expect(r.verbesserungAussagbar).toBe(false);
    expect(r.satz).toContain("Ob es besser wird als heute, sagt sie nicht");
  });

  it("sagt es, wenn gar nichts vergleichbar ist", () => {
    const r = vergleichen("a_gegen_heute", [geldOhneHeute]);
    expect(r.verbesserungAussagbar).toBe(false);
    expect(r.satz).toContain("Für keinen Punkt");
  });
});
