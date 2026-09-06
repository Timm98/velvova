import { describe, expect, it } from "vitest";
import { lebensrechnung, vergleiche } from "./rechnung.ts";

/**
 * Die Zahl, nach der jemand eine Entscheidung trifft.
 *
 * „70.000 statt 63.000" klingt nach siebentausend. Nach Steuern und
 * einem längeren Arbeitsweg bleiben davon vielleicht hundertfünfzig Euro
 * im Monat — und das ist die Auskunft, die zählt.
 */

describe("Was übrig bleibt", () => {
  it("zieht Fixkosten und Jobkosten vom Netto ab", () => {
    const r = lebensrechnung(3660, { wohnen: 1200, lebensmittel: 400 }, { pendeln: 220 });
    expect(r.nettoMonat).toBe(3660);
    expect(r.fixkostenMonat).toBe(1600);
    expect(r.jobkostenMonat).toBe(220);
    expect(r.freiMonat).toBe(1840);
    expect(r.freiJahr).toBe(22080);
  });

  it("zeigt ein Minus als Minus", () => {
    // Wer mehr ausgibt als hereinkommt, soll das sehen. Eine Rechnung,
    // die bei null aufhört, verschweigt genau die Auskunft, die zählt.
    const r = lebensrechnung(1800, { wohnen: 1500, lebensmittel: 500 });
    expect(r.freiMonat).toBe(-200);
  });
});

describe("Nichts erfinden", () => {
  it("nennt jeden Posten, der nicht angegeben wurde", () => {
    /*
     * Der wichtigste Test.
     *
     * Eine Rechnung mit erfundenen Durchschnittswerten sieht vollständig
     * aus und ist falsch — in eine Richtung, die niemand nachprüft.
     * „1.338 € frei verfügbar" liest sich als Ergebnis, auch wenn die
     * Miete fehlt.
     */
    const r = lebensrechnung(3000, { wohnen: 1200 });
    expect(r.unbekannt).toContain("Lebensmittel");
    expect(r.unbekannt).toContain("Versicherungen");
    expect(r.unbekannt).not.toContain("Wohnen");
    expect(r.angegeben.von).toBe(1);
    expect(r.angegeben.moeglich).toBeGreaterThan(10);
  });

  it("unterscheidet eine ausdrückliche Null von einer fehlenden Angabe", () => {
    // „Ich zahle keine Miete" ist etwas anderes als „ich habe nichts
    // eingetragen". Wer beides gleich behandelt, kann nicht sagen, wie
    // vollständig die Rechnung ist.
    const r = lebensrechnung(3000, { wohnen: 0 });
    expect(r.unbekannt).not.toContain("Wohnen");
    expect(r.angegeben.von).toBe(1);
  });

  it("rechnet ohne jede Angabe nur das Netto", () => {
    const r = lebensrechnung(3000);
    expect(r.freiMonat).toBe(3000);
    expect(r.angegeben.von).toBe(0);
    expect(r.unbekannt.length).toBeGreaterThan(10);
  });
});

describe("Zwei Stellen nebeneinander", () => {
  it("rechnet den echten Unterschied, nicht den beim Brutto", () => {
    /*
     * Der Fall aus der Anforderung: mehr Netto, aber auch mehr
     * Pendelkosten. Die Differenz der Differenzen ist die Antwort.
     */
    const v = vergleiche(
      { nettoMonat: 3810, jobkosten: { pendeln: 260 } },
      { nettoMonat: 3500, jobkosten: { pendeln: 120 } },
    );
    expect(v.nettoUnterschiedMonat).toBe(310);
    expect(v.jobkostenUnterschiedMonat).toBe(140);
    expect(v.freiUnterschiedMonat).toBe(170);
    expect(v.freiUnterschiedJahr).toBe(2040);
  });

  it("erkennt, dass ein niedrigeres Brutto mehr übrig lassen kann", () => {
    // Remote statt Pendeln: weniger Netto, deutlich weniger Kosten.
    const v = vergleiche(
      { nettoMonat: 3400, jobkosten: { pendeln: 0 } },
      { nettoMonat: 3500, jobkosten: { pendeln: 300 } },
    );
    expect(v.freiUnterschiedMonat).toBe(200);
  });

  it("warnt, wenn die beiden Seiten ungleich gefüllt sind", () => {
    /*
     * Wer für die neue Stelle Pendelkosten einträgt und für die
     * aktuelle nicht, sieht die neue schlechter aussehen, als sie ist —
     * und die Zahl darunter behauptet trotzdem eine Differenz.
     */
    const v = vergleiche(
      { nettoMonat: 3800, jobkosten: { pendeln: 200 } },
      { nettoMonat: 3500 },
    );
    expect(v.vergleichbar).toBe(false);
    expect(v.hinweis).toContain("unterschiedlich viele");
  });

  it("gilt als vergleichbar, wenn beide Seiten gleich gefüllt sind", () => {
    const v = vergleiche(
      { nettoMonat: 3800, jobkosten: { pendeln: 200 } },
      { nettoMonat: 3500, jobkosten: { pendeln: 100 } },
    );
    expect(v.vergleichbar).toBe(true);
    expect(v.hinweis).toBeNull();
  });
});
