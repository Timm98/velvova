import { describe, expect, it } from "vitest";
import { leistungenAusText, leistungsnamen } from "./leistungen.ts";

/**
 * Was in einer Anzeige steht — und was nicht.
 *
 * Die beiden Fehlerrichtungen sind hier nicht gleich teuer:
 *
 *   **Übersehen** kostet nichts. Die Leistung steht im Text, die Person
 *   liest sie dort und fragt im Gespräch danach.
 *
 *   **Erfinden** kostet Vertrauen, und zwar vor dem Arbeitgeber. Wer
 *   sich auf „Firmenwagen" verlässt, weil es hier stand, steht im
 *   Gespräch als jemand da, der die Anzeige nicht gelesen hat.
 *
 * Die Tests sind entsprechend gewichtet: Der zweite Block ist der
 * wichtigere.
 */

describe("Was erkannt wird", () => {
  it("erkennt die üblichen Leistungen einer deutschen Anzeige", () => {
    const text = `Wir bieten dir:
      • 30 Tage Urlaub
      • Homeoffice an zwei Tagen pro Woche
      • Betriebliche Altersvorsorge
      • Ein Jobticket für den ÖPNV
      • Regelmässige Weiterbildung`;
    const arten = leistungenAusText(text).map((l) => l.art);
    expect(arten).toContain("urlaub");
    expect(arten).toContain("homeoffice");
    expect(arten).toContain("altersvorsorge");
    expect(arten).toContain("mobilitaet");
    expect(arten).toContain("weiterbildung");
  });

  it("liefert zu jeder Leistung einen Beleg aus dem Text", () => {
    /*
     * Ohne Beleg ist „Altersvorsorge" eine Behauptung des Produkts über
     * den Arbeitgeber. Mit Beleg ist es ein Zitat, das jemand im
     * Gespräch vorlesen kann.
     */
    for (const l of leistungenAusText("Wir bieten eine betriebliche Altersvorsorge und Gleitzeit.")) {
      expect(l.beleg.length, l.label).toBeGreaterThan(0);
      expect(l.beleg.toLowerCase(), l.label).toContain("wir bieten");
    }
  });

  it("liest die Zahl der Urlaubstage mit", () => {
    expect(leistungenAusText("30 Tage Urlaub").find((l) => l.art === "urlaub")?.wert).toBe(30);
    expect(leistungenAusText("Du hast 28 Urlaubstage.").find((l) => l.art === "urlaub")?.wert).toBe(28);
  });

  it("verwirft unplausible Urlaubszahlen", () => {
    // „12 Urlaubstage" liegt unter dem gesetzlichen Mindestanspruch,
    // „99" gibt es nicht. Beides ist eher ein Lesefehler als eine
    // Angabe — und eine falsche Zahl ist schlimmer als keine.
    expect(leistungenAusText("12 Tage Urlaub").find((l) => l.art === "urlaub")?.wert).toBeNull();
    expect(leistungenAusText("99 Urlaubstage").find((l) => l.art === "urlaub")?.wert).toBeNull();
  });

  it("nennt jede Leistung höchstens einmal", () => {
    // „Homeoffice" steht in einer Anzeige oft dreimal. Dreimal
    // dieselbe Karte ist keine Auskunft, sondern Lärm.
    const text = "Homeoffice möglich. Wir leben Homeoffice. Homeoffice nach Absprache.";
    expect(leistungenAusText(text).filter((l) => l.art === "homeoffice")).toHaveLength(1);
  });

  it("gibt eine stabile Reihenfolge zurück", () => {
    /*
     * Zwei Anzeigen mit denselben Leistungen müssen dieselbe Liste
     * ergeben — sonst sieht ein Vergleich nach einem Unterschied aus,
     * wo nur die Textstellen anders angeordnet sind.
     */
    const a = leistungsnamen("Gleitzeit. Homeoffice. Weiterbildung.");
    const b = leistungsnamen("Weiterbildung. Homeoffice. Gleitzeit.");
    expect(a).toEqual(b);
  });
});

describe("Was NICHT erkannt wird", () => {
  it("zählt eine verneinte Leistung nicht", () => {
    /*
     * Der teure Fall.
     *
     * „Homeoffice ist leider nicht möglich" enthält das Wort und meint
     * das Gegenteil. Wer diesen Satz als Leistung zählt, schreibt dem
     * Arbeitgeber etwas gut, das er ausdrücklich ausgeschlossen hat.
     */
    for (const satz of [
      "Homeoffice ist leider nicht möglich.",
      "Kein Firmenwagen vorgesehen.",
      "Keine betriebliche Altersvorsorge.",
      "Diese Stelle wird ohne die Möglichkeit auf mobiles Arbeiten besetzt.",
    ]) {
      expect(leistungenAusText(satz), satz).toEqual([]);
    }
  });

  it("lässt eine Verneinung im Nachbarsatz in Ruhe", () => {
    // Ein „kein" drei Sätze weiter hat mit dem Treffer nichts zu tun.
    // Sonst verlöre eine Anzeige alle Leistungen, sobald irgendwo das
    // Wort „keine" steht — und das steht fast überall.
    const text = "Wir bieten Homeoffice an zwei Tagen. Keine Reisetätigkeit erforderlich.";
    expect(leistungenAusText(text).map((l) => l.art)).toContain("homeoffice");
  });

  it("erfindet nichts bei leerem oder fehlendem Text", () => {
    expect(leistungenAusText("")).toEqual([]);
    expect(leistungenAusText(null)).toEqual([]);
    expect(leistungenAusText(undefined)).toEqual([]);
    expect(leistungenAusText("   ")).toEqual([]);
  });

  it("findet nichts in einem gewöhnlichen Aufgabentext", () => {
    /*
     * Der Test gegen zu weite Muster.
     *
     * Ein Aufgabentext ohne Leistungsangaben muss eine leere Liste
     * ergeben. Wären die Muster zu weit, bekäme jede Anzeige dieselben
     * Karten — und die Auskunft wäre wertlos, ohne falsch auszusehen.
     */
    const text =
      "Sie betreuen unsere Bestandskunden, erstellen Angebote und pflegen die Stammdaten " +
      "im ERP-System. Eine abgeschlossene kaufmännische Ausbildung setzen wir voraus.";
    expect(leistungenAusText(text)).toEqual([]);
  });

  it("verwechselt „Remote-Standort“ nicht mit Remote-Arbeit", () => {
    // Grenzfall, bewusst festgehalten: Das Muster verlangt das Wort
    // als eigenes Wort. „Remotehilfe" oder „Fernwartung" fallen nicht
    // darunter.
    expect(leistungenAusText("Fernwartung von Anlagen gehört zu Ihren Aufgaben.")).toEqual([]);
  });
});

describe("Muster, die zu weit waren", () => {
  it("zählt die Weiterentwicklung eines Produkts nicht als Weiterbildung", () => {
    /*
     * An echten Anzeigen gemessen und dabei aufgefallen.
     *
     * „Wir arbeiten an der Weiterentwicklung unserer Technologie-Sparte"
     * ist ein Satz über das Produkt. Als Leistung gezählt lässt er die
     * Anzeige besser aussehen, als sie ist — und niemand könnte
     * nachvollziehen, woher die Karte kommt.
     */
    const text = "Gleichzeitig arbeiten wir an der Weiterentwicklung und dem Ausbau unserer Plattform.";
    expect(leistungenAusText(text).map((l) => l.art)).not.toContain("weiterbildung");
  });

  it("zählt die eigene Weiterentwicklung weiterhin", () => {
    const text = "Klare Strukturen sorgen für deine Weiterentwicklung.";
    expect(leistungenAusText(text).map((l) => l.art)).toContain("weiterbildung");
  });
});

describe("Der Beleg als Zitat", () => {
  it("entfernt Aufzählungszeichen und Emoji am Anfang", () => {
    /*
     * An echten Anzeigen aufgefallen: „- Betriebliche Altersvorsorge"
     * und „✅ Lernen & Weiterbildung". Das gehört zur Formatierung, nicht
     * zur Aussage — und in Anführungszeichen gesetzt sieht es nach einem
     * Lesefehler aus.
     */
    expect(leistungenAusText("- Betriebliche Altersvorsorge")[0]!.beleg).toBe(
      "Betriebliche Altersvorsorge",
    );
    expect(leistungenAusText("✅ Lernen & Weiterbildung")[0]!.beleg).toBe("Lernen & Weiterbildung");
    expect(leistungenAusText("* Gleitzeit möglich")[0]!.beleg).toBe("Gleitzeit möglich");
  });

  it("lässt Satzzeichen INNERHALB des Belegs stehen", () => {
    // Ein Gedankenstrich mitten in einer Aussage trägt Bedeutung.
    const beleg = leistungenAusText("Gleitzeit — auch an Freitagen")[0]!.beleg;
    expect(beleg).toContain("Gleitzeit");
  });

  it("kürzt sehr lange Sätze mit Auslassungszeichen", () => {
    const lang = `Wir bieten Homeoffice ${"und viele weitere Vorteile ".repeat(20)}`;
    const beleg = leistungenAusText(lang)[0]!.beleg;
    expect(beleg.length).toBeLessThanOrEqual(160);
    expect(beleg.endsWith("…")).toBe(true);
  });
});
