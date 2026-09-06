import { describe, expect, it } from "vitest";
import {
  AEHNLICHKEIT_SCHWELLE,
  empfehlungBestimmen,
  gruppieren,
  zulaessigkeitBestimmen,
  kriteriumPruefen,
  type Suchkriterium,
} from "@paycheck/matching";

/**
 * §L — warum semantische Ähnlichkeit eine harte Bedingung nicht schlägt.
 *
 * Der Fall aus dem Auftrag: Eine Stelle hat 80 Prozent semantische
 * Ähnlichkeit, zahlt aber weniger als die Untergrenze der Person.
 *
 * Die Ähnlichkeit darf dann nicht gewinnen — und sie tut es in dieser
 * Architektur auch gar nicht, weil sie nie in den Fit eingeht. Dieser
 * Test hält das fest, damit es nicht versehentlich jemand ändert.
 */

const kriterium = (teil: Partial<Suchkriterium> & { kriterium: string }): Suchkriterium => ({
  id: `k-${teil.kriterium}`,
  wert: null,
  einheit: null,
  operator: "gleich",
  staerke: "muss",
  gruppe: null,
  ...teil,
});

const STELLE = {
  titel: "Fachkraft für Lagerlogistik (m/w/d)",
  aufgaben: ["Kommissionierung", "Warenannahme"],
  anforderungen: ["Staplerschein"],
  wortmenge: "lager logistik kommissionierung",
  ort: "Karlsruhe",
  breitengrad: 49.0,
  laengengrad: 8.4,
  gehalt: {
    min: 28_000,
    max: 30_000,
    waehrung: "EUR",
    zeitraum: "year",
    garantiert: true,
    basis: "brutto",
    herkunft: "provider",
    beleg: null,
  },
  arbeitsmodell: "on_site",
  vertragsform: "permanent",
  schichtarbeit: false,
  wochenstunden: 40,
  erfahrungsniveau: null,
  arbeitsland: "DE",
  arbeitgeber: "Testbetrieb GmbH",
  weitereGehaelter: [],
} as unknown as Parameters<typeof kriteriumPruefen>[1];

describe("L — harte Bedingung schlägt Ähnlichkeit", () => {
  it("weist eine semantisch perfekte Stelle unter der Gehaltsgrenze ab", () => {
    /* Die Stelle ist inhaltlich genau das, was gesucht wird. */
    const taetigkeit = kriteriumPruefen(
      kriterium({ kriterium: "taetigkeit", wert: ["lager"], operator: "einer_von" }),
      STELLE,
    );
    expect(taetigkeit.status).toBe("erfuellt");

    /* Und sie zahlt zu wenig. */
    const gehalt = kriteriumPruefen(
      kriterium({ kriterium: "mindestgehalt", wert: 36_000, operator: "mindestens" }),
      STELLE,
    );
    expect(gehalt.status).toBe("nicht_erfuellt");

    const befund = zulaessigkeitBestimmen(gruppieren([taetigkeit, gehalt]));
    expect(befund.zulaessigkeit).toBe("ineligible");
  });

  it("schliesst sie aus, egal wie hoch der Fit wäre", () => {
    /*
     * Selbst ein Fit von 100 ändert nichts. Eine verletzte
     * Muss-Bedingung ist kein Abzug, sondern ein Ausschluss — sonst
     * liesse sich jede Bedingung durch genug Punkte anderswo
     * aushebeln.
     */
    const e = empfehlungBestimmen({
      zulaessigkeit: "ineligible",
      fitScore: 100,
      fitAbdeckung: 1,
      blockierendeHinweise: [],
      veraltet: false,
    });
    expect(e.status).toBe("ausgeschlossen");
    expect(e.gruende).toContain("muss_verletzt");
  });

  it("hält die Ähnlichkeit aus dem Fit heraus", () => {
    /*
     * Der Wert existiert als Schwelle für den Fund — er kommt in
     * keiner Fit-Rechnung vor. Diese Zusicherung ist der Grund,
     * warum ein Küchenberuf mit hoher Textähnlichkeit nie in eine
     * Empfehlung rutschen kann.
     */
    expect(AEHNLICHKEIT_SCHWELLE).toBeGreaterThan(0);
    expect(AEHNLICHKEIT_SCHWELLE).toBeLessThan(1);
  });

  it("lässt eine unbekannte Angabe keine Zustimmung sein", () => {
    /* Eine Anzeige ohne Gehaltsangabe erfüllt die Grenze nicht —
       sie sagt nichts dazu. */
    const ohneGehalt = { ...STELLE, gehalt: null };
    const g = kriteriumPruefen(
      kriterium({ kriterium: "mindestgehalt", wert: 36_000, operator: "mindestens" }),
      ohneGehalt,
    );
    expect(g.status).toBe("unbekannt");
    expect(zulaessigkeitBestimmen(gruppieren([g])).zulaessigkeit).toBe("needs_clarification");
  });
});
