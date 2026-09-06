import { describe, expect, it } from "vitest";
import { gehaltAusText } from "./gehalt-aus-text.ts";

/**
 * Eine falsch gelesene Zahl ist teurer als eine fehlende.
 *
 * Sie entscheidet über eine harte Bedingung: wer „mindestens 45.000"
 * gesagt hat, sieht eine Stelle nicht mehr, wenn wir hier eine 38.000
 * aus einem Satz über Projektbudgets herauslesen. Ausgeblendete
 * Stellen fallen niemandem auf.
 *
 * Deshalb stehen unten mehr Nein- als Ja-Fälle.
 */

describe("Erkennt, was wirklich dasteht", () => {
  it("liest eine Spanne mit Gehaltswort", () => {
    const g = gehaltAusText("Wir bieten ein Jahresgehalt von 45.000 – 55.000 € je nach Erfahrung.");
    expect(g?.min).toBe(45000);
    expect(g?.max).toBe(55000);
    expect(g?.period).toBe("year");
  });

  it("liest einen Einzelwert", () => {
    const g = gehaltAusText("Das Einstiegsgehalt beträgt 48.000 EUR pro Jahr.");
    expect(g?.min).toBe(48000);
    expect(g?.max).toBeNull();
  });

  it("erkennt Monatsgehälter", () => {
    const g = gehaltAusText("Die Vergütung liegt bei 3.800 € pro Monat.");
    expect(g?.min).toBe(3800);
    expect(g?.period).toBe("month");
  });

  it("erkennt Stundenlöhne", () => {
    const g = gehaltAusText("Der Stundenlohn beträgt 18 € pro Stunde.");
    expect(g?.min).toBe(18);
    expect(g?.period).toBe("hour");
  });

  it("versteht die k-Schreibweise", () => {
    const g = gehaltAusText("Gehalt: 55k € jährlich.");
    expect(g?.min).toBe(55000);
  });

  it("liefert immer den Beleg mit", () => {
    // Ohne Textstelle ist die Zahl nicht überprüfbar — und eine
    // unüberprüfbare Zahl gehört nicht neben eine bestätigte Angabe.
    const g = gehaltAusText("Wir zahlen ein Gehalt von 52.000 € im Jahr.");
    expect(g?.beleg).toContain("52.000");
    expect(g?.herkunft).toBe("text");
  });
});

describe("Lässt liegen, was kein Gehalt ist", () => {
  it("hält ein Projektbudget nicht für ein Gehalt", () => {
    /*
     * Der gefährlichste Fall: Währung dabei, Betrag plausibel, und
     * trotzdem völlig anderes Thema.
     */
    expect(gehaltAusText("Du verantwortest ein Projektbudget von 250.000 €.")).toBeNull();
  });

  it("hält einen Umsatz nicht für ein Gehalt", () => {
    expect(gehaltAusText("Unser Team erwirtschaftet 80.000 € Umsatz im Monat.")).toBeNull();
  });

  it("nimmt keine Zahl ohne Währung und ohne Gehaltswort", () => {
    expect(gehaltAusText("Wir betreuen 45.000 Kunden in ganz Europa.")).toBeNull();
  });

  it("hält eine Jahreszahl nicht für einen Betrag", () => {
    expect(gehaltAusText("Das Unternehmen wurde 2019 gegründet und wächst seitdem.")).toBeNull();
  });

  it("verwirft Beträge ausserhalb plausibler Grenzen", () => {
    // 2.000.000 € ist kein Jahresgehalt für eine Sachbearbeitung, und
    // 200 € auch nicht.
    expect(gehaltAusText("Gehalt von 2.000.000 € pro Jahr.")).toBeNull();
    expect(gehaltAusText("Ein Jahresgehalt von 200 € ist vorgesehen.")).toBeNull();
  });

  it("verwirft eine Spanne, die rückwärts läuft", () => {
    // „55.000 bis 45.000" ist ein Tippfehler oder etwas anderes —
    // aber keine Gehaltsspanne, die man jemandem zeigen sollte.
    expect(gehaltAusText("Gehalt von 55.000 bis 45.000 €.")).toBeNull();
  });

  it("lässt kurze und leere Texte in Ruhe", () => {
    expect(gehaltAusText("")).toBeNull();
    expect(gehaltAusText("45.000 €")).toBeNull();
  });
});

describe("Kennzeichnung", () => {
  it("behauptet nie, es sei eine Anbieterangabe", () => {
    /*
     * Der Kern der ganzen Datei. Was hier herauskommt, ist gelesen —
     * nicht gemeldet. Ein Feld, das der Arbeitgeber ausgefüllt hat,
     * und eine Zahl aus einem Fliesstext dürfen in der Oberfläche nie
     * gleich aussehen.
     */
    const g = gehaltAusText("Das Jahresgehalt beträgt 50.000 €.");
    expect(g).not.toBeNull();
    expect(g!.herkunft).toBe("text");
    expect(Object.keys(g!)).not.toContain("disclosed");
  });
});

describe("An echten Anzeigen gemessen", () => {
  /*
   * Diese Fälle stammen aus 2.506 importierten Anzeigen.
   *
   * 113 nannten einen Eurobetrag, den der Erkenner nicht fasste. Der
   * häufigste Grund war nicht das Zahlenmuster, sondern das
   * Gehaltswort: Die Liste kannte „Gehalt" und „Vergütung" — aber nicht
   * „brutto", das in deutschen Anzeigen am häufigsten dasteht.
   */
  it("liest eine Monatsspanne mit „brutto“", () => {
    const b = gehaltAusText(
      "VOLLZEIT | VOR ORT BEI UNSEREM KUNDENPROJEKT 4.000 € BIS 5.000 € BRUTTO PRO MONAT",
    );
    expect(b).toMatchObject({ min: 4000, max: 5000, period: "month" });
  });

  it("liest eine Jahresspanne ohne das Wort „Gehalt“", () => {
    const b = gehaltAusText("Was wir zahlen: 55.000 bis 75.000 EUR brutto im Jahr, je nach Erfahrung.");
    expect(b).toMatchObject({ min: 55000, max: 75000, period: "year" });
  });

  it("liest „p. a.“ als Jahresangabe", () => {
    const b = gehaltAusText(
      "mit einer Gehaltsspanne von ca. 60.000 - 75.000 Euro brutto p. a. + Firmenwagen",
    );
    expect(b).toMatchObject({ min: 60000, max: 75000, period: "year" });
  });
});

describe("Was weiterhin KEIN Gehalt ist", () => {
  /*
   * Die Gegenrichtung, und die teurere.
   *
   * Ein übersehenes Gehalt kostet eine Angabe. Ein erfundenes steht als
   * Zahl auf der Jobseite, geht in die Nettorechnung ein und in den
   * Vergleich zweier Stellen. Jedes Wort, das der Erkenner dazulernt,
   * muss hier gegengeprüft werden.
   */
  it("hält eine Prämie nicht für ein Gehalt", () => {
    expect(gehaltAusText("Weiterempfehlungsbonus in Höhe von 1.000€ für jede Empfehlung")).toBeNull();
  });

  it("hält einen Fahrtkostenzuschuss nicht für ein Gehalt", () => {
    expect(
      gehaltAusText("Mobility & Events: Bis zu 467 € fürs Öffi- oder Deutschlandticket"),
    ).toBeNull();
  });

  it("hält ein betreutes Budget nicht für ein Gehalt", () => {
    expect(
      gehaltAusText("Wir betreuen für unsere Kunden ein Budget von 250.000 € pro Jahr im Bereich Media."),
    ).toBeNull();
  });
});
