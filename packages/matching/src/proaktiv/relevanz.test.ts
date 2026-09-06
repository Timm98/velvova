import { describe, expect, it } from "vitest";
import { darfUnterbrechen, neuheitNach, relevanz, RELEVANZ_SCHWELLE } from "./relevanz.ts";

/*
 * Die Beispiele aus dem Auftrag, Punkt 6.
 *
 * Sie sind der Massstab für die Schwelle: Was dort als hochrelevant
 * steht, muss durchkommen; was dort als niedrigrelevant steht, darf
 * nicht. Eine Zahl ohne diese Fälle wäre geraten.
 */

const grundlage = {
  neuheit: 1,
  handelbar: true,
  passtZumKontext: true,
  schonGezeigt: false,
};

describe("Was unterbrechen darf", () => {
  it("lässt den Traumjob durch, der die harte Gehaltsgrenze verletzt", () => {
    const wert = relevanz({
      ...grundlage,
      wirkung: 0.9,
      konfidenz: 0.95,
      dringlichkeit: 0.8,
    });
    expect(wert).toBeGreaterThan(RELEVANZ_SCHWELLE);
  });

  it("lässt mehrere sehr starke neue Treffer durch", () => {
    expect(
      darfUnterbrechen({ ...grundlage, wirkung: 0.7, konfidenz: 0.85, dringlichkeit: 0.5 }),
    ).toBe(true);
  });

  it("lässt die eine Angabe durch, an der die Karriereentscheidung hängt", () => {
    expect(
      darfUnterbrechen({ ...grundlage, wirkung: 0.9, konfidenz: 0.9, dringlichkeit: 0.7 }),
    ).toBe(true);
  });

  it("lässt eine starke Diskrepanz zwischen Aussage und Verhalten durch", () => {
    /* Ein Widerspruch mit voller Stärke — drei Gegenbelege und mehr. */
    expect(
      darfUnterbrechen({ ...grundlage, wirkung: 0.7, konfidenz: 0.6, dringlichkeit: 0.4 }),
    ).toBe(true);
  });
});

describe("Was schweigt", () => {
  it("schweigt bei einem einzeln weggeklickten Job", () => {
    expect(
      darfUnterbrechen({ ...grundlage, wirkung: 0.1, konfidenz: 0.3, dringlichkeit: 0.1 }),
    ).toBe(false);
  });

  it("schweigt bei einer minimalen Änderung im Ähnlichkeitswert", () => {
    expect(
      darfUnterbrechen({ ...grundlage, wirkung: 0.05, konfidenz: 0.9, dringlichkeit: 0 }),
    ).toBe(false);
  });

  it("schweigt bei einer schwachen Vermutung", () => {
    expect(
      darfUnterbrechen({ ...grundlage, wirkung: 0.3, konfidenz: 0.4, dringlichkeit: 0.1 }),
    ).toBe(false);
  });

  it("schweigt bei einer bereits gesagten Erkenntnis — egal wie wichtig", () => {
    expect(
      relevanz({
        ...grundlage,
        wirkung: 1,
        konfidenz: 1,
        dringlichkeit: 1,
        schonGezeigt: true,
      }),
    ).toBe(0);
  });

  it("schweigt, wenn nichts daraus folgt", () => {
    /*
     * Eine Erkenntnis ohne Handlungsmöglichkeit ist eine Mitteilung
     * über den Zustand des Systems. Die Person kann damit nichts tun.
     */
    expect(
      relevanz({ ...grundlage, wirkung: 1, konfidenz: 1, dringlichkeit: 1, handelbar: false }),
    ).toBe(0);
  });

  it("schiebt auf, was gerade nicht passt", () => {
    expect(
      relevanz({
        ...grundlage,
        wirkung: 1,
        konfidenz: 1,
        dringlichkeit: 1,
        passtZumKontext: false,
      }),
    ).toBe(0);
  });
});

describe("Neuheit", () => {
  it("ist beim ersten Mal voll und danach halb so viel", () => {
    expect(neuheitNach(0)).toBe(1);
    expect(neuheitNach(1)).toBe(0.5);
    expect(neuheitNach(2)).toBe(0.25);
  });

  it("gibt einem mittelwichtigen Hinweis genau zwei Anläufe", () => {
    /*
     * Der erste Anlauf kann untergegangen sein — jemand las die
     * Nachricht nicht, oder er hatte gerade anderes zu tun. Der
     * zweite ist eine Nachfrage. Der dritte wäre Drängen.
     */
    const lage = { ...grundlage, wirkung: 0.7, konfidenz: 0.6, dringlichkeit: 0.4 };
    expect(darfUnterbrechen(lage)).toBe(true);
    expect(darfUnterbrechen({ ...lage, neuheit: neuheitNach(1) })).toBe(true);
    expect(darfUnterbrechen({ ...lage, neuheit: neuheitNach(2) })).toBe(false);
  });

  it("gibt einem schwachen Hinweis nur einen", () => {
    const lage = { ...grundlage, wirkung: 0.5, konfidenz: 0.6, dringlichkeit: 0.3 };
    expect(darfUnterbrechen(lage)).toBe(true);
    expect(darfUnterbrechen({ ...lage, neuheit: neuheitNach(1) })).toBe(false);
  });
});
