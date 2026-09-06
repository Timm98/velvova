import { describe, expect, it } from "vitest";
import { jahresbetrag, quartile } from "./entgeltreferenz.ts";

/**
 * Was zwischen einer Anzeige und einer Gehaltsspanne schiefgehen kann.
 *
 * Drei Fehler, die man einer fertigen Zahl später nicht mehr ansieht:
 * der Festbetrag wird übersehen, der Zeitraum wird verwechselt, oder
 * ein Tippfehler in der Anzeige wird übernommen. Jeder davon erzeugt
 * eine Zahl, die formatiert und mit Quellenangabe dasteht.
 */

describe("Aus einer Anzeige ein Jahresgehalt", () => {
  it("mittelt eine Jahresspanne", () => {
    expect(
      jahresbetrag({ verguetungsangabe: "JAHRESGEHALT", gehaltsspanneVon: 45000, gehaltsspanneBis: 55000 }),
    ).toBe(50000);
  });

  it("nimmt den Festbetrag, wenn keine Spanne dasteht", () => {
    // Der übersehene zweite Weg: 25 von 80 Anzeigen mit Betrag.
    expect(jahresbetrag({ verguetungsangabe: "JAHRESGEHALT", festgehalt: 48000 })).toBe(48000);
  });

  it("lässt die Spanne gewinnen, wenn beides dasteht", () => {
    expect(
      jahresbetrag({
        verguetungsangabe: "JAHRESGEHALT",
        gehaltsspanneVon: 45000,
        gehaltsspanneBis: 55000,
        festgehalt: 99000,
      }),
    ).toBe(50000);
  });

  it("rechnet ein Monatsgehalt aufs Jahr", () => {
    expect(jahresbetrag({ verguetungsangabe: "MONATSGEHALT", festgehalt: 4000 })).toBe(48000);
  });

  it("rechnet einen Stundenlohn mit 47 Arbeitswochen", () => {
    /*
     * Nicht 52.
     *
     * Urlaub und Feiertage sind nicht gearbeitete Zeit. Mit 52 läge
     * jede hochgerechnete Stundenangabe systematisch rund 10 % zu hoch
     * — und zwar bei allen gleich, also unauffällig.
     */
    expect(jahresbetrag({ verguetungsangabe: "STUNDENLOHN", festgehalt: 25 })).toBe(25 * 40 * 47);
  });

  it("verwirft einen Betrag ohne Zeitraum", () => {
    // „3.200" ist als Monatsgehalt plausibel und als Jahresgehalt
    // unmöglich. Raten wäre hier um den Faktor zwölf teuer.
    expect(jahresbetrag({ festgehalt: 3200 })).toBeNull();
    expect(jahresbetrag({ verguetungsangabe: "KEINE_ANGABEN", festgehalt: 3200 })).toBeNull();
  });

  it("verwirft einen Tippfehler in der Anzeige", () => {
    // Echt vorgefunden: Jahresgehalt, Festbetrag 15.
    expect(jahresbetrag({ verguetungsangabe: "JAHRESGEHALT", festgehalt: 15 })).toBeNull();
    expect(jahresbetrag({ verguetungsangabe: "STUNDENLOHN", festgehalt: 3 })).toBeNull();
    expect(jahresbetrag({ verguetungsangabe: "JAHRESGEHALT", festgehalt: 9_000_000 })).toBeNull();
  });

  it("verwirft, was aufs Jahr gerechnet unmöglich wird", () => {
    // 150 €/Stunde ist als Stundensatz denkbar, ergibt aufs Jahr aber
    // 282.000 € — über der Grenze, ab der wir nichts mehr behaupten.
    expect(jahresbetrag({ verguetungsangabe: "STUNDENLOHN", festgehalt: 150 })).toBeNull();
  });
});

describe("Quartile", () => {
  it("gibt nichts zurück unter der Mindestzahl", () => {
    // Sieben Werte sind keine Spanne. Die Grenze steht an einer
    // Stelle, damit sie nicht an der Disziplin des Aufrufers hängt.
    expect(quartile([40000, 41000, 42000, 43000, 44000, 45000, 46000])).toBeNull();
  });

  it("rechnet ab der Mindestzahl", () => {
    const w = [30000, 35000, 40000, 45000, 50000, 55000, 60000, 65000];
    const q = quartile(w)!;
    expect(q.q1).toBeLessThan(q.median);
    expect(q.median).toBeLessThan(q.q3);
    expect(q.median).toBe(50000);
  });

  it("kommt mit unsortierter Eingabe zurecht", () => {
    const a = quartile([60000, 30000, 45000, 35000, 65000, 40000, 55000, 50000])!;
    const b = quartile([30000, 35000, 40000, 45000, 50000, 55000, 60000, 65000])!;
    expect(a).toEqual(b);
  });

  it("verändert die übergebene Liste nicht", () => {
    // Der Aufrufer zählt sie danach noch. Eine Funktion, die im
    // Vorbeigehen sortiert, ist eine Falle für den nächsten Leser.
    const w = [60000, 30000, 45000, 35000, 65000, 40000, 55000, 50000];
    quartile(w);
    expect(w[0]).toBe(60000);
  });
});
