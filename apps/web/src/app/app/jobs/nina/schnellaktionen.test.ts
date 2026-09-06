import { describe, expect, it } from "vitest";
import { HOECHSTENS, schnellaktionen, type Lage } from "./schnellaktionen";

const lage = (over: Partial<Lage> = {}): Lage => ({
  hatGehalt: true,
  hatUnternehmensdaten: true,
  hatVergleichsstelle: true,
  hatPassung: true,
  hatAufgaben: true,
  hatAnforderungen: true,
  hatWohnort: true,
  anzahlDafuer: 2,
  anzahlDagegen: 0,
  anzahlOffen: 0,
  ...over,
});

describe("schnellaktionen", () => {
  it("verspricht keine Gehaltsdaten, wenn keine dastehen", () => {
    /*
     * Der Knopf bleibt — die Frage nach dem Gehalt ist berechtigt,
     * auch wenn die Anzeige schweigt. Nur die Beschriftung darf nicht
     * so tun, als hätten wir Zahlen.
     */
    const a = schnellaktionen(lage({ hatGehalt: false }));
    expect(a.some((x) => x.label === "Gehalt prüfen")).toBe(false);
    expect(a.some((x) => x.label === "Gehalt nicht angegeben")).toBe(true);
  });

  it("bietet den Vergleich nicht ohne zweite Stelle an", () => {
    const a = schnellaktionen(lage({ hatVergleichsstelle: false }));
    expect(a.some((x) => x.ansicht === "vergleich")).toBe(false);
  });

  it("fragt nicht nach Gegenargumenten, wenn es keine gibt", () => {
    // Eine leere Liste unter dieser Überschrift liest sich wie ein
    // Versäumnis statt wie ein Befund.
    const a = schnellaktionen(lage({ anzahlDagegen: 0 }));
    expect(a.some((x) => x.label.startsWith("Was spricht gegen"))).toBe(false);
  });

  it("stellt die Passungsfrage nach oben", () => {
    // Sie ist die Frage, mit der jemand eine Anzeige öffnet.
    expect(schnellaktionen(lage())[0]?.ansicht).toBe("passung");
  });

  it("stellt Gegenargumente direkt danach", () => {
    const a = schnellaktionen(lage({ anzahlDagegen: 2 }));
    expect(a.slice(0, 3).some((x) => x.ansicht === "dagegen")).toBe(true);
  });

  it("bietet die Bewerbung hier gar nicht an", () => {
    /*
     * Sie steht als eigener Knopf bei den Fakten, wo sie hingehört.
     * Ein zweites Mal zwischen den Fragen wäre Drängen — und die
     * Vorschläge sind Fragen, keine Handlungsaufforderungen.
     */
    expect(schnellaktionen(lage()).some((x) => x.ansicht === "bewerbung")).toBe(false);
  });

  it("rückt ähnliche Stellen vor, wenn vieles dagegen spricht", () => {
    const a = schnellaktionen(lage({ anzahlDagegen: 3 }));
    const i = a.findIndex((x) => x.ansicht === "aehnliche");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThanOrEqual(1);
  });

  it("zeigt nie mehr als die Höchstzahl", () => {
    expect(schnellaktionen(lage({ anzahlDagegen: 2 })).length).toBeLessThanOrEqual(HOECHSTENS);
  });

  it("bietet auch ohne jede Angabe noch einen Weg an", () => {
    // Ein leeres Panel wäre die schlechteste Antwort.
    const a = schnellaktionen(lage({
      hatGehalt: false, hatUnternehmensdaten: false,
      hatVergleichsstelle: false, hatPassung: false,
    }));
    expect(a.length).toBeGreaterThan(0);
  });

  it("fragt ohne belastbare Passung anders, statt zu schweigen", () => {
    /*
     * Die Frage wegzulassen hiesse, die naheliegendste ausgerechnet
     * dann zu verstecken, wenn sie am wichtigsten ist. Stattdessen
     * ändert sich, was der Knopf verspricht.
     */
    const a = schnellaktionen(lage({ hatPassung: false }));
    const p = a.find((x) => x.ansicht === "passung");
    expect(p).toBeDefined();
    expect(p?.label).not.toMatch(/Passt der Job/);
  });

  it("bietet den Arbeitsweg nur mit hinterlegtem Wohnort an", () => {
    // Ohne Wohnort gibt es nichts zu rechnen, nur eine Aufforderung.
    expect(schnellaktionen(lage({ hatWohnort: false })).some((x) => x.ansicht === "arbeitsweg")).toBe(false);
  });

  it("bietet den Arbeitsalltag nur an, wenn die Anzeige ihn beschreibt", () => {
    expect(schnellaktionen(lage({ hatAufgaben: false })).some((x) => x.ansicht === "arbeitsalltag")).toBe(false);
  });
});
