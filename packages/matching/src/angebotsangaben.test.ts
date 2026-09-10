import { describe, expect, it } from "vitest";
import {
  angebotAlsStelle,
  befristungAusText,
  wochenstundenAusText,
  type Angebotszeile,
} from "./angebotsangaben.ts";
import { kriteriumPruefen } from "./suchkriterien.ts";

const A = (teil: Partial<Angebotszeile> = {}): Angebotszeile => ({
  rollenprofil: { rolle: "Pflegefachkraft", anforderungen: ["Erfahrung Innere"] },
  konditionen: {
    gehaltVon: 3900,
    gehaltBis: 4400,
    arbeitszeit: "vollzeit",
    ort: "Berlin",
    befristung: "unbefristet",
  },
  anonymBeschreibung: "Träger im Osten der Stadt, ca. 400 Betten",
  ...teil,
});

describe("wochenstundenAusText", () => {
  it("liest eine genannte Zahl", () => {
    expect(wochenstundenAusText("Teilzeit 30 Stunden")).toBe(30);
    expect(wochenstundenAusText("32h")).toBe(32);
  });

  it("nimmt Vollzeit als 40", () => {
    expect(wochenstundenAusText("Vollzeit")).toBe(40);
  });

  it("rät bei „Teilzeit“ ohne Zahl nicht", () => {
    /*
     * Auf 20 zu runden wäre eine Behauptung über einen Vertrag, den
     * niemand gesehen hat — und sie liesse eine Muss-Prüfung bestehen
     * oder scheitern, die „unbekannt" lauten müsste.
     */
    expect(wochenstundenAusText("Teilzeit")).toBeNull();
    expect(wochenstundenAusText(null)).toBeNull();
    expect(wochenstundenAusText("nach Absprache")).toBeNull();
  });

  it("nimmt keine unsinnige Zahl an", () => {
    expect(wochenstundenAusText("1000 Stunden")).toBeNull();
  });
});

describe("befristungAusText", () => {
  it("unterscheidet die drei Zustände", () => {
    expect(befristungAusText("unbefristet")).toBe(false);
    expect(befristungAusText("befristet auf 2 Jahre")).toBe(true);
    expect(befristungAusText(null)).toBeNull();
    expect(befristungAusText("Festanstellung")).toBeNull();
  });
});

describe("angebotAlsStelle", () => {
  it("macht aus dem Gehalt eine Zusage", () => {
    /*
     * Der ganze Unterschied zu einer Anzeige: „bis zu 50.000“ ist
     * keine Zusage, ein Angebot ist eine.
     */
    const s = angebotAlsStelle(A());
    expect(s.gehalt?.garantiert).toBe(true);
    expect(s.gehalt?.min).toBe(3900);
    expect(s.gehalt?.herkunft).toBe("employer");
  });

  it("nennt vor dem Aufdecken keinen Arbeitgebernamen", () => {
    const s = angebotAlsStelle(A());
    expect(s.arbeitgeber).toBe("Träger im Osten der Stadt, ca. 400 Betten");
  });

  it("lässt unbekannt, was das Angebot nicht sagt", () => {
    const s = angebotAlsStelle(A({ konditionen: { ort: "Berlin" } }));
    expect(s.gehalt).toBeNull();
    expect(s.wochenstunden).toBeNull();
    expect(s.befristet).toBeNull();
    expect(s.arbeitsmodell).toBeNull();
    expect(s.schichtarbeit).toBeNull();
  });

  it("trägt die Anforderungen des Betriebs weiter", () => {
    expect(angebotAlsStelle(A()).anforderungen).toEqual(["Erfahrung Innere"]);
  });
});

describe("dieselbe Prüfung wie bei einer Anzeige", () => {
  /*
   * Der Punkt der ganzen Datei: Ein Angebot geht durch
   * `kriteriumPruefen`, nicht durch eine zweite Rechnung. Zwei
   * Rechnungen für dieselbe Frage laufen auseinander.
   */
  /*
   * `mindestgehalt` steht in Euro pro JAHR — `kriteriumSatz` sagt
   * „mindestens … EUR im Jahr". 3.800 im Monat sind 45.600 im Jahr.
   * Beim ersten Versuch stand hier der Monatsbetrag, und der Test war
   * grün, wo er hätte rot sein müssen: Ein Angebot über 3.200 im
   * Monat galt als erfüllt, weil 38.400 über 3.800 liegen.
   */
  const KRITERIUM = {
    id: "k1",
    kriterium: "mindestgehalt",
    wert: 45_600,
    einheit: null,
    operator: "mindestens",
    staerke: "muss",
    gruppe: null,
  } as const;

  it("erfüllt ein Muss-Gehalt, wenn das Angebot darüber liegt", () => {
    const e = kriteriumPruefen(KRITERIUM as never, angebotAlsStelle(A()));
    expect(e.status).toBe("erfuellt");
  });

  it("verletzt es, wenn das Angebot darunter liegt", () => {
    const e = kriteriumPruefen(
      KRITERIUM as never,
      angebotAlsStelle(A({ konditionen: { gehaltVon: 3200, arbeitszeit: "vollzeit" } })),
    );
    expect(e.status).toBe("nicht_erfuellt");
  });

  it("sagt „unbekannt“, wenn das Angebot kein Gehalt nennt", () => {
    const e = kriteriumPruefen(
      KRITERIUM as never,
      angebotAlsStelle(A({ konditionen: { arbeitszeit: "vollzeit" } })),
    );
    expect(e.status).toBe("unbekannt");
  });
});
