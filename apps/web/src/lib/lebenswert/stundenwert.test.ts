import { describe, expect, it } from "vitest";
import { stundenvergleich, stundenwert } from "./stundenwert.ts";

/**
 * Die Zahl, die zwei Stellen fair vergleicht — und die Fälle, in denen
 * sie besser nicht dasteht.
 *
 * Der teure Fehler ist hier nicht ein falscher Cent. Er ist eine Zahl,
 * die auf einer Annahme beruht: Wer bei fehlender Stundenangabe mit 40
 * rechnet, zeigt für eine 20-Stunden-Stelle den halben Stundenwert —
 * und zwar nach unten, also gegen die Stelle. Genau darauf zielen die
 * Tests im zweiten Block.
 */

describe("Der Stundenwert", () => {
  it("rechnet Netto durch Arbeitsstunden je Monat", () => {
    // 40 Std./Woche × 52/12 = 173,33 Std./Monat. 3.466,67 / 173,33 = 20,00
    const { wert, grund } = stundenwert(3466.67, 40);
    expect(grund).toBeNull();
    expect(wert!.arbeitsstundenJeMonat).toBe(173);
    expect(wert!.proArbeitsstunde).toBeCloseTo(20, 1);
  });

  it("zählt den Arbeitsweg als aufgewendete Zeit dazu", () => {
    /*
     * Der Kern der Sache.
     *
     * Die Zeit im Zug ist genauso weg wie die am Schreibtisch, nur
     * unbezahlt. Wer sie nicht mitrechnet, vergleicht eine Stelle
     * nebenan mit einer zwei Städte weiter, als wären sie gleich teuer.
     */
    const { wert } = stundenwert(3466.67, 40, 26);
    expect(wert!.proAufgewendeterStunde).toBeLessThan(wert!.proArbeitsstunde);
    // 3.466,67 / (173,33 + 26) = 17,39
    expect(wert!.proAufgewendeterStunde).toBeCloseTo(17.39, 1);
  });

  it("beziffert, was der Weg je Stunde kostet", () => {
    const { wert } = stundenwert(3466.67, 40, 26);
    expect(wert!.wegkostenJeStunde).toBeCloseTo(2.61, 1);
  });

  it("lässt den Weg offen, wenn er nicht bekannt ist", () => {
    // Nicht null als „kein Weg" lesen: 0 hiesse, jemand arbeitet
    // ausschliesslich zu Hause, und das ist eine ganz andere Auskunft.
    const { wert } = stundenwert(3466.67, 40);
    expect(wert!.proAufgewendeterStunde).toBeNull();
    expect(wert!.wegkostenJeStunde).toBeNull();
  });

  it("rechnet mit einem Weg von null Stunden, wenn er ausdrücklich null ist", () => {
    const { wert } = stundenwert(3466.67, 40, 0);
    expect(wert!.proAufgewendeterStunde).toBeCloseTo(wert!.proArbeitsstunde, 2);
    expect(wert!.wegkostenJeStunde).toBe(0);
  });
});

describe("Wann keine Zahl erscheint", () => {
  it("rechnet ohne Wochenstunden nicht — und sagt, warum", () => {
    const { wert, grund } = stundenwert(3466.67, null);
    expect(wert).toBeNull();
    expect(grund).toMatch(/Wochenstunden/);
    // Der Grund muss auch sagen, warum nicht einfach 40 angenommen wird.
    expect(grund).toMatch(/Teilzeit/);
  });

  it("rechnet ohne Netto nicht", () => {
    expect(stundenwert(null, 40).wert).toBeNull();
    expect(stundenwert(0, 40).wert).toBeNull();
  });

  it("nimmt keine 40 Stunden an, wenn 20 dastehen", () => {
    /*
     * Der Test, der die Annahme verbietet.
     *
     * Bei halber Stundenzahl ist der Stundenwert doppelt so hoch. Wer
     * hier 40 unterstellte, zeigte für eine Teilzeitstelle die Hälfte —
     * und eine gut bezahlte Teilzeitstelle sähe aus wie eine schlechte
     * Vollzeitstelle.
     */
    const halb = stundenwert(1733.33, 20).wert!;
    const voll = stundenwert(3466.67, 40).wert!;
    expect(halb.proArbeitsstunde).toBeCloseTo(voll.proArbeitsstunde, 1);
  });
});

describe("Zwei Stellen nebeneinander", () => {
  it("erkennt, dass die schlechter bezahlte je Stunde besser sein kann", () => {
    /*
     * Der Fall, für den es diese Rechnung überhaupt gibt.
     *
     * Mehr Geld, mehr Stunden, längerer Weg — und je aufgewendeter
     * Stunde bleibt weniger. Im Brutto sieht man das nicht.
     */
    const neu = stundenwert(4000, 40, 43).wert; // 70k, 5 Tage à 1 Std. Weg
    const alt = stundenwert(3114, 35, 15).wert; // 63k, 3 Tage à 35 Min.
    const v = stundenvergleich(neu, alt)!;
    expect(v.besser).toBe("aktuell");
    expect(v.unterschied).toBeLessThan(0);
  });

  it("vergleicht nicht, wenn nur eine Seite den Weg kennt", () => {
    /*
     * Sonst fiele die Differenz systematisch zugunsten der Seite aus,
     * über die wir weniger wissen — die Stelle ohne bekannten Weg
     * bekäme ihre Zeit geschenkt.
     */
    const mitWeg = stundenwert(3466.67, 40, 26).wert;
    const ohneWeg = stundenwert(3466.67, 40).wert;
    expect(stundenvergleich(mitWeg, ohneWeg)).toBeNull();
  });

  it("vergleicht nicht gegen eine fehlende Seite", () => {
    expect(stundenvergleich(stundenwert(3466.67, 40).wert, null)).toBeNull();
    expect(stundenvergleich(null, stundenwert(3466.67, 40).wert)).toBeNull();
  });

  it("nennt Gleichstand als Gleichstand", () => {
    const a = stundenwert(3466.67, 40, 20).wert;
    const b = stundenwert(3466.67, 40, 20).wert;
    expect(stundenvergleich(a, b)!.besser).toBe("gleich");
  });
});
