import { describe, expect, it } from "vitest";
import { makeJob } from "./fixtures.ts";
import { alltagsPassung, dimensionenVergleichen, stellenDimensionen } from "./arbeitsdimensionen.ts";
import { zusammenfassen, type Arbeitsdimension } from "@paycheck/domain";

/**
 * Der Career Twin — und vor allem sein Schweigen.
 *
 * Die gefährliche Fassung dieses Codes wäre eine, die für jede Stelle
 * zehn Zahlen ausgibt. Sie sähe vollständig aus, und die Hälfte davon
 * wäre geraten. Diese Tests halten fest, dass nur dasteht, was belegt
 * ist.
 */

describe("Was nicht dasteht, wird nicht geschätzt", () => {
  it("gibt für eine wortlose Anzeige keine Dimensionen aus", () => {
    const job = makeJob({
      title: "Mitarbeiter",
      descriptionTokens: "wir suchen zum nächstmöglichen zeitpunkt eine person",
      coreTasks: [],
      benefits: [],
      contractType: null,
      shiftWork: null,
      experienceLevel: null,
    });
    expect(stellenDimensionen(job)).toEqual([]);
  });

  it("nimmt das harte Feld vor der Formulierung", () => {
    /*
     * „Langfristige Perspektive" im Fliesstext gegen `permanent` im
     * Vertragsfeld: Das Feld ist eine Angabe, der Satz eine Absicht.
     */
    const job = makeJob({
      contractType: "permanent",
      descriptionTokens: "befristet projektbezogen start-up",
    });
    const sicherheit = stellenDimensionen(job).find((d) => d.dimension === "sicherheit");
    expect(sicherheit?.wert).toBeGreaterThan(0.7);
    expect(sicherheit?.beleg).toContain("unbefristet");
  });
});

describe("Widersprüche gewinnen nicht", () => {
  it("senkt die Sicherheit, statt das letzte Wort entscheiden zu lassen", () => {
    /*
     * Eine Anzeige, die „strukturiert" UND „kein Tag wie der andere"
     * verspricht, sagt über die Struktur nichts Verlässliches.
     */
    const eindeutig = makeJob({ descriptionTokens: "strukturiert geregelte abläufe feste prozesse" });
    const widerspruch = makeJob({ descriptionTokens: "strukturiert und kein tag wie der andere" });
    const a = stellenDimensionen(eindeutig).find((d) => d.dimension === "struktur");
    const b = stellenDimensionen(widerspruch).find((d) => d.dimension === "struktur");
    expect(a?.sicherheit ?? 0).toBeGreaterThan((b?.sicherheit ?? 0) * 1.5);
  });
});

describe("Verglichen wird nur, wo beide Seiten etwas sagen", () => {
  const stelle = stellenDimensionen(
    makeJob({ descriptionTokens: "kundenkontakt kundenbetreuung beratung von kunden" }),
  );

  it("lässt eine Achse aus, zu der die Person nichts gesagt hat", () => {
    // Ein leeres Profil ergibt keinen Abstand von null, sondern nichts.
    expect(dimensionenVergleichen(new Map(), stelle)).toEqual([]);
    expect(alltagsPassung([])).toBeNull();
  });

  it("erkennt einen echten Widerspruch", () => {
    /*
     * Die Stelle ist voller Kundenkontakt, die Person will keinen.
     * Das ist der Fall, an dem Menschen scheitern, obwohl sie die
     * Arbeit können — und den ein Wortabgleich nie gefunden hätte.
     */
    const mensch = new Map<Arbeitsdimension, { wert: number; gewicht: number }>([
      ["kundenkontakt", { wert: 0.1, gewicht: 0.9 }],
    ]);
    const v = dimensionenVergleichen(mensch, stelle);
    expect(v).toHaveLength(1);
    expect(v[0]!.abstand).toBeGreaterThan(0.6);
    const passung = alltagsPassung(v);
    expect(passung!.wert).toBeLessThan(0.4);
  });
});

describe("Beobachtetes wiegt schwerer als Behauptetes", () => {
  it("zieht den Wert zur Beobachtung", () => {
    /*
     * Jemand sagt im Gespräch, er arbeite gern unter Druck. Nach
     * neunzig Tagen in einem hektischen Job sagt er das Gegenteil.
     * Die spätere Beobachtung wiegt mehr — aber die Aussage wird
     * nicht gelöscht, sondern gewichtet.
     */
    const zusammen = zusammenfassen([
      { dimension: "belastung", wert: 0.9, herkunft: "selbstauskunft", beleg: "sagt: mag Druck", bestaetigt: true, erfasstAm: new Date(0) },
      { dimension: "belastung", wert: 0.2, herkunft: "beobachtet", beleg: "Check-in nach 90 Tagen", bestaetigt: true, erfasstAm: new Date(1) },
    ]);
    expect(zusammen!.wert).toBeLessThan(0.55);
    expect(zusammen!.wert).toBeGreaterThan(0.2);
  });

  it("gibt einer einzelnen Selbstauskunft wenig Gewicht", () => {
    const einzeln = zusammenfassen([
      { dimension: "tempo", wert: 0.8, herkunft: "selbstauskunft", beleg: "", bestaetigt: true, erfasstAm: new Date() },
    ]);
    expect(einzeln!.gewicht).toBeLessThan(0.5);
  });
});

describe("Bestätigung entscheidet über das Gewicht", () => {
  /*
   * Was Nina aus einem Nebensatz liest, ist ein Vorschlag — kein
   * Befund. Es soll wirken, sonst bliebe das Profil leer; aber nicht
   * so stark wie eine Aussage, der jemand zugestimmt hat.
   */
  const wert = (bestaetigt: boolean | null) => ({
    dimension: "autonomie" as const,
    wert: 0.9,
    herkunft: "gespraech" as const,
    beleg: "im Gespräch gesagt",
    bestaetigt,
    erfasstAm: new Date(),
  });

  it("zählt eine unbestätigte Ableitung halb", () => {
    const offen = zusammenfassen([wert(null)])!;
    const zugestimmt = zusammenfassen([wert(true)])!;
    expect(offen.gewicht).toBeCloseTo(zugestimmt.gewicht / 2, 5);
    /* Der Wert selbst ändert sich nicht — nur, wie schwer er wiegt. */
    expect(offen.wert).toBeCloseTo(zugestimmt.wert, 5);
  });

  it("lässt eine abgelehnte Ableitung ganz weg", () => {
    /*
     * Wer sagt „nein, so habe ich das nicht gemeint", hat die Aussage
     * zurückgenommen. Sie mit halbem Gewicht weiterzuführen wäre die
     * Behauptung, er habe sie doch irgendwie gemeint.
     */
    expect(zusammenfassen([wert(false)])).toBeNull();
  });

  it("lässt eine Ablehnung die übrigen Angaben nicht verfälschen", () => {
    const gemischt = zusammenfassen([
      wert(false),
      { ...wert(true), wert: 0.2 },
    ])!;
    expect(gemischt.wert).toBeCloseTo(0.2, 5);
  });
});
