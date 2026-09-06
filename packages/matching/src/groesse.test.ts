import { describe, expect, it } from "vitest";
import { computeJobQuality, groessenZuschlag } from "./jobQuality.ts";
import { makeJob } from "./fixtures.ts";

/**
 * Die Betriebsgrösse als Stabilitätssignal.
 *
 * ── Warum das vorsichtig sein muss ────────────────────────────
 *
 * „Ist dieser Job in ein paar Jahren noch da" hing bisher allein an
 * der Vertragsart. Ein unbefristeter Vertrag bei einem
 * Dreipersonenbetrieb und einer im Konzern sind aber nicht dasselbe
 * Versprechen.
 *
 * Die teure Fehlerrichtung wäre, daraus „gross ist besser" zu machen.
 * Ein Konzern ist stabiler und oft unbeweglicher. Deshalb ein
 * Zuschlag von höchstens einem Fünftel — und keiner, wo die
 * Vertragsart gar nichts sagt.
 */

describe("Grössenzuschlag", () => {
  it("hebt bei grossen Arbeitgebern", () => {
    expect(groessenZuschlag("10,001+ employees")).toBeGreaterThan(0);
    expect(groessenZuschlag("1,001-5,000 employees")).toBeGreaterThan(0);
  });

  it("senkt bei sehr kleinen", () => {
    expect(groessenZuschlag("2-10 employees")).toBeLessThan(0);
    expect(groessenZuschlag("11-50 employees")).toBeLessThan(0);
  });

  it("bleibt im mittleren Bereich neutral", () => {
    /*
     * Zwischen fünfzig und zweihundert sagt die Zahl über
     * Bestandsfestigkeit wenig. Dort etwas zu unterstellen wäre eine
     * Genauigkeit, die die Daten nicht hergeben.
     */
    expect(groessenZuschlag("51-200 employees")).toBe(0);
  });

  it("bleibt bei fehlender Angabe wirkungslos", () => {
    // Der Normalfall: 99,9 % der Firmen sind nicht angereichert.
    expect(groessenZuschlag(null)).toBe(0);
    expect(groessenZuschlag(undefined)).toBe(0);
    expect(groessenZuschlag("")).toBe(0);
    expect(groessenZuschlag("keine Angabe")).toBe(0);
  });

  it("bleibt in Grenzen", () => {
    for (const g of ["10,001+ employees", "2-10 employees", "51-200 employees", "unfug"]) {
      expect(Math.abs(groessenZuschlag(g)), g).toBeLessThanOrEqual(0.2);
    }
  });
});

describe("Wirkung auf die Jobqualität", () => {
  const basis = { reviews: [], themes: [] };

  it("macht denselben Vertrag im Konzern sicherer als im Kleinbetrieb", () => {
    const job = makeJob({ contractType: "permanent" });
    const konzern = computeJobQuality({ ...basis, job, mitarbeiter: "10,001+ employees" });
    const klein = computeJobQuality({ ...basis, job, mitarbeiter: "2-10 employees" });
    /*
     * `score` ist `number | null` — null heisst „nicht ausreichend
     * beurteilbar". Hier muss beides einen Wert haben, sonst prüft der
     * Vergleich nichts.
     */
    expect(konzern.score).not.toBeNull();
    expect(klein.score).not.toBeNull();
    expect(konzern.score!).toBeGreaterThan(klein.score!);
  });

  it("macht aus einem befristeten Vertrag keinen unbefristeten", () => {
    /*
     * Der Fehler, den das verhindert: „grosser Arbeitgeber" mit
     * „sicherer Vertrag" zu verwechseln. Eine Befristung im Konzern
     * bleibt eine Befristung — sie darf nie so sicher wirken wie ein
     * unbefristeter Vertrag im Kleinbetrieb.
     */
    const befristetGross = computeJobQuality({
      ...basis,
      job: makeJob({ contractType: "fixed_term" }),
      mitarbeiter: "10,001+ employees",
    });
    const unbefristetKlein = computeJobQuality({
      ...basis,
      job: makeJob({ contractType: "permanent" }),
      mitarbeiter: "2-10 employees",
    });
    expect(befristetGross.score).not.toBeNull();
    expect(unbefristetKlein.score).not.toBeNull();
    expect(befristetGross.score!).toBeLessThan(unbefristetKlein.score!);
  });

  it("ändert nichts, wenn die Vertragsart unbekannt ist", () => {
    // Aus der Grösse allein lässt sich keine Beschäftigungssicherheit
    // ableiten — dann bleibt die Dimension unbeurteilt.
    const job = makeJob({ contractType: null, benefits: [] });
    const mit = computeJobQuality({ ...basis, job, mitarbeiter: "10,001+ employees" });
    const ohne = computeJobQuality({ ...basis, job });
    expect(mit.score).toBe(ohne.score);
  });
});
