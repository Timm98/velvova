import { describe, expect, it } from "vitest";
import { beiBuerotagen, pendelkostenMonat, pendelrechnung } from "./pendelzeit.ts";

/**
 * „45 Minuten Arbeitsweg" klingt erträglich. Zweimal täglich, zwei Tage
 * die Woche, das ganze Jahr — das sind fast zehn Arbeitstage. Dieselbe
 * Zahl, zwei völlig verschiedene Auskünfte.
 */

describe("Zeit, die der Weg kostet", () => {
  it("rechnet hin und zurück, nicht einfach", () => {
    const p = pendelrechnung(45, 2);
    expect(p.taeglichMinuten).toBe(90);
    expect(p.woechentlichStunden).toBe(3);
  });

  it("macht aus Wochen Monate und Jahre", () => {
    const p = pendelrechnung(45, 2);
    // 3 Stunden je Woche · 52/12 Wochen je Monat
    expect(p.monatlichStunden).toBe(13);
    // 3 Stunden · 46 Arbeitswochen
    expect(p.jaehrlichStunden).toBe(138);
  });

  it("nennt die Jahreszeit in Arbeitstagen", () => {
    // „138 Stunden" sagt wenig, „17 Arbeitstage" sagt alles.
    expect(pendelrechnung(45, 2).jaehrlichArbeitstage).toBe(17.3);
  });

  it("unterscheidet Hybrid von Vor Ort", () => {
    /*
     * Der Punkt, an dem sich zwei Stellen mit gleichem Arbeitsweg
     * unterscheiden. Ohne die Bürotage steht nur „60 Minuten" da — und
     * das ist bei fünf Tagen etwas anderes als bei zwei.
     */
    const zwei = pendelrechnung(60, 2);
    const fuenf = pendelrechnung(60, 5);
    expect(fuenf.jaehrlichStunden).toBeGreaterThan(zwei.jaehrlichStunden * 2);
  });

  it("rechnet mehrere Bürotage nebeneinander", () => {
    // In Anzeigen steht oft „ein bis drei Tage". Welcher es wird,
    // verhandelt man.
    const r = beiBuerotagen(30, [1, 2, 3]);
    expect(r).toHaveLength(3);
    expect(r[2]!.monatlichStunden).toBeGreaterThan(r[0]!.monatlichStunden);
  });

  it("rechnet mit 52/12 Wochen, nicht mit 4", () => {
    /*
     * Der Unterschied sind knapp zwei Wochen im Jahr. Bei einer Stunde
     * Arbeitsweg also gut vier Stunden, die sonst unter den Tisch
     * fielen.
     */
    const p = pendelrechnung(60, 5);
    expect(p.monatlichStunden).toBeGreaterThan(p.woechentlichStunden * 4);
  });
});

describe("Kosten nur mit Angabe", () => {
  it("rechnet, wenn Entfernung und Kilometerkosten da sind", () => {
    // 25 km einfach → 50 km am Tag → 100 km die Woche →
    // 433 km im Monat → bei 0,30 €/km rund 130 €.
    expect(pendelkostenMonat(25, 2, 0.3)).toBeCloseTo(130, 0);
  });

  it("gibt null zurück, wenn etwas fehlt", () => {
    /*
     * Was ein Kilometer kostet, hängt am Fahrzeug, am Verbrauch und am
     * Spritpreis. Eine Standardannahme wäre eine Zahl, die niemand
     * geprüft hat und auf die sich jemand verlässt.
     */
    expect(pendelkostenMonat(25, 2, null)).toBeNull();
    expect(pendelkostenMonat(null, 2, 0.3)).toBeNull();
  });
});
