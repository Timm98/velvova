import { describe, expect, it } from "vitest";
import {
  aufJahr,
  erfuelltEinkommensMuss,
  festerAnteilGeklaert,
  verguetungVergleichbar,
  type Verguetungsangabe,
} from "./verguetungsangabe.ts";

const grundlage: Verguetungsangabe = {
  von: null,
  bis: null,
  waehrung: "EUR",
  zeitraum: "jahr",
  stundenbasis: null,
  teil: "fest",
  quelle: "arbeitgeber",
  belege: ["fundstelle-1"],
};

describe("Vergütungsangaben (Prüffall B02)", () => {
  it("macht aus einem Portalkopf kein garantiertes Festgehalt", () => {
    /*
     * Der Fall aus der Wettbewerbsprüfung: 28.000–38.000 im Kopf, im
     * lesbaren Text kein Betrag. Die Zahl darf gezeigt werden — sie
     * belegt nur nichts.
     */
    const a: Verguetungsangabe = { ...grundlage, von: 28_000, bis: 38_000, quelle: "portal" };
    const b = erfuelltEinkommensMuss(a, 30_000);
    expect(b.erfuellt).toBe("offen");
    expect(b.alsNachweisGeeignet).toBe(false);
    expect(b.grund).toContain("nicht vom Arbeitgeber");
  });

  it("lässt den festen Anteil offen, wenn die Zusammensetzung fehlt", () => {
    const a: Verguetungsangabe = { ...grundlage, von: 60_000, bis: 60_000, teil: "unbestimmt" };
    expect(festerAnteilGeklaert(a)).toBe(false);
    const b = erfuelltEinkommensMuss(a, 45_000);
    expect(b.erfuellt).toBe("offen");
    expect(b.alsNachweisGeeignet).toBe(false);
  });

  it("entscheidet nichts, wenn die Bedingung mitten in der Spanne liegt", () => {
    const a: Verguetungsangabe = { ...grundlage, von: 28_000, bis: 38_000 };
    const b = erfuelltEinkommensMuss(a, 32_000);
    expect(b.erfuellt).toBe("offen");
    expect(b.grund).toContain("innerhalb der angegebenen Spanne");
  });

  it("erfüllt die Bedingung, wenn schon die Untergrenze darüber liegt", () => {
    const a: Verguetungsangabe = { ...grundlage, von: 50_000, bis: 60_000 };
    const b = erfuelltEinkommensMuss(a, 45_000);
    expect(b.erfuellt).toBe("ja");
    expect(b.alsNachweisGeeignet).toBe(true);
  });

  it("verneint erst, wenn auch die Obergrenze darunter liegt", () => {
    const a: Verguetungsangabe = { ...grundlage, von: 28_000, bis: 38_000 };
    expect(erfuelltEinkommensMuss(a, 45_000).erfuellt).toBe("nein");
  });

  it("rechnet einen Stundensatz nicht ohne Stundenbasis hoch", () => {
    /*
     * Die übliche Abkürzung wäre, 40 Stunden anzunehmen. Sie macht aus
     * einer Teilzeitstelle rechnerisch eine Vollzeitstelle.
     */
    const a: Verguetungsangabe = { ...grundlage, von: 22, bis: 26, zeitraum: "stunde" };
    expect(aufJahr(a, 22)).toBeNull();
    expect(erfuelltEinkommensMuss(a, 40_000).erfuellt).toBe("offen");
  });

  it("rechnet einen Stundensatz mit Basis korrekt hoch", () => {
    const a: Verguetungsangabe = {
      ...grundlage,
      von: 25,
      bis: 25,
      zeitraum: "stunde",
      stundenbasis: 40,
    };
    expect(aufJahr(a, 25)).toBe(25 * 40 * 52);
    expect(erfuelltEinkommensMuss(a, 45_000).erfuellt).toBe("ja");
  });
});

describe("Vergleichbarkeit", () => {
  it("vergleicht nicht über Währungen hinweg", () => {
    const a: Verguetungsangabe = { ...grundlage, von: 60_000 };
    const b: Verguetungsangabe = { ...grundlage, von: 80_000, waehrung: "CHF" };
    expect(verguetungVergleichbar(a, b).vergleichbar).toBe(false);
  });

  it("vergleicht kein Festgehalt gegen ein Gesamtpaket", () => {
    const a: Verguetungsangabe = { ...grundlage, von: 60_000 };
    const b: Verguetungsangabe = { ...grundlage, von: 65_000, teil: "gesamt" };
    const r = verguetungVergleichbar(a, b);
    expect(r.vergleichbar).toBe(false);
    expect(r.grund).toContain("Gesamtpaket");
  });

  it("erlaubt den Vergleich auf gleicher Grundlage", () => {
    const a: Verguetungsangabe = { ...grundlage, von: 60_000 };
    const b: Verguetungsangabe = { ...grundlage, von: 65_000 };
    expect(verguetungVergleichbar(a, b).vergleichbar).toBe(true);
  });
});
