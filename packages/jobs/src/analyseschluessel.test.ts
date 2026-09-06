import { describe, expect, it } from "vitest";
import {
  analysePruefen,
  analyseschluessel,
  fassungsstand,
  type Analyseeingabe,
} from "./analyseschluessel.ts";

const e = (over: Partial<Analyseeingabe> = {}): Analyseeingabe => ({
  title: "Facharbeiter Sägerei (m/w/d)",
  description: "Du bedienst die Anlage und prüfst das Material.",
  salaryMin: 38000, salaryMax: 44000, salaryCurrency: "EUR", salaryPeriod: "year",
  location: "Biberach", country: "DE", workModel: "on_site",
  contractType: "permanent", weeklyHours: 40, experienceLevel: null,
  ...over,
});

describe("analyseschluessel", () => {
  it("ist für dieselbe Anzeige stabil", () => {
    expect(analyseschluessel(e())).toBe(analyseschluessel(e()));
  });

  it("ändert sich beim Gehalt", () => {
    // Eine Anzeige, die ihr Gehalt ändert, ist eine andere Aussage.
    expect(analyseschluessel(e({ salaryMin: 42000 }))).not.toBe(analyseschluessel(e()));
  });

  it("ändert sich bei der Arbeitszeit", () => {
    // Von Vollzeit auf Teilzeit ist eine andere Stelle.
    expect(analyseschluessel(e({ weeklyHours: 20 }))).not.toBe(analyseschluessel(e()));
  });

  it("ändert sich beim Text", () => {
    expect(analyseschluessel(e({ description: "Etwas ganz anderes." }))).not.toBe(
      analyseschluessel(e()),
    );
  });

  it("ändert sich NICHT durch Zeilenumbrüche oder doppelte Leerzeichen", () => {
    /*
     * Quellen liefern denselben Text mal mit \r\n, mal mit \n. Das ist
     * keine Änderung der Anzeige, sondern eine des Transports — und
     * eine Neuanalyse dafür wäre die teuerste Art, nichts zu tun.
     */
    expect(analyseschluessel(e({ description: "Du bedienst die Anlage\r\nund  prüfst das Material." })))
      .toBe(analyseschluessel(e({ description: "Du bedienst die Anlage\nund prüfst das Material." })));
  });

  it("hängt nicht von der Reihenfolge der Felder ab", () => {
    // `JSON.stringify` folgt der Einfügereihenfolge; zwei Codepfade
    // ergäben sonst verschiedene Prüfsummen für dieselbe Anzeige.
    const a = analyseschluessel(e());
    const umgedreht = Object.fromEntries(Object.entries(e()).reverse()) as Analyseeingabe;
    expect(analyseschluessel(umgedreht)).toBe(a);
  });
});

describe("analysePruefen", () => {
  it("meldet eine fehlende Analyse", () => {
    expect(analysePruefen(null, "abc")).toEqual({ gueltig: false, grund: "fehlt" });
  });

  it("meldet eine geänderte Anzeige", () => {
    const p = analysePruefen({ schluessel: "alt", fassung: fassungsstand() }, "neu");
    expect(p).toEqual({ gueltig: false, grund: "anzeige_geaendert" });
  });

  it("meldet eine veraltete Fassung getrennt", () => {
    /*
     * Der Grund muss unterscheidbar sein: Bei veralteter Fassung darf
     * die vorhandene Extraktion wiederverwendet und nur neu gerechnet
     * werden — bei geänderter Anzeige nicht.
     */
    const p = analysePruefen({ schluessel: "abc", fassung: 0 }, "abc");
    expect(p).toEqual({ gueltig: false, grund: "fassung_veraltet" });
  });

  it("lässt eine aktuelle Analyse gelten", () => {
    expect(analysePruefen({ schluessel: "abc", fassung: fassungsstand() }, "abc")).toEqual({
      gueltig: true,
    });
  });

  it("erkennt eine neuere Fassung nicht als veraltet", () => {
    // Eine ältere Instanz darf eine neuere Analyse nicht überschreiben.
    expect(analysePruefen({ schluessel: "abc", fassung: fassungsstand() + 1 }, "abc").gueltig).toBe(
      true,
    );
  });
});
