import { describe, expect, it } from "vitest";
import { MIN_ZUSAGEN_FUER_QUOTE, promiseKept, type Zusagenpruefung } from "./zusagen.ts";

/**
 * Der Promise-Kept-Score.
 *
 * ── Was hier geschützt wird ───────────────────────────────────
 *
 * Diese Quote soll später neben einem Arbeitgeber stehen. Sie muss
 * deshalb schweigen, wenn sie nichts weiss — und sie darf einen
 * Arbeitgeber nicht für etwas abwerten, das noch gar nicht fällig war.
 */

const p = (stand: Zusagenpruefung["stand"], herkunft: Zusagenpruefung["herkunft"] = "gespraech"): Zusagenpruefung =>
  ({ punkt: "homeoffice", herkunft, stand });

describe("Was noch nicht fällig war, zählt nicht", () => {
  it("lässt `zu_frueh` aus der Quote heraus", () => {
    /*
     * „Zwei Homeoffice-Tage nach dem ersten Monat" lässt sich nach
     * vierzehn Tagen nicht beurteilen. Als Bruch gezählt wäre es eine
     * Falschaussage über den Arbeitgeber.
     */
    const r = promiseKept([...Array(8).fill(p("gehalten")), ...Array(5).fill(p("zu_frueh"))]);
    expect(r.beurteilt).toBe(8);
    expect(r.zuFrueh).toBe(5);
    expect(r.quote).toBe(1);
  });

  it("schweigt unter der Schwelle", () => {
    const r = promiseKept(Array(MIN_ZUSAGEN_FUER_QUOTE - 1).fill(p("gehalten")));
    expect(r.quote).toBeNull();
    /* Die Zählung steht trotzdem da — sie ist nachvollziehbar. */
    expect(r.gehalten).toBe(MIN_ZUSAGEN_FUER_QUOTE - 1);
  });

  it("schweigt, wenn nur Unfälliges vorliegt", () => {
    expect(promiseKept(Array(20).fill(p("zu_frueh"))).quote).toBeNull();
  });
});

describe("Teilweise ist weder das eine noch das andere", () => {
  it("zählt halb", () => {
    /*
     * „Zwei Tage zugesagt, einen bekommen" als Bruch zu zählen
     * überzeichnete; als gehalten zu zählen verschwiege den
     * Unterschied.
     */
    const r = promiseKept(Array(8).fill(p("teilweise")));
    expect(r.quote).toBeCloseTo(0.5, 5);
  });
});

describe("Die Herkunft wiegt mit", () => {
  it("straft einen gebrochenen Gesprächszusage härter als eine Anzeigenaussage", () => {
    /*
     * Was in einer Anzeige steht, ist eine Werbeaussage — verfasst,
     * bevor jemand den Bewerber kannte. Was der Arbeitgeber auf
     * Nachfrage bestätigt hat, ist eine Zusage an diese Person.
     */
    const ausAnzeige = promiseKept([
      ...Array(7).fill(p("gehalten", "arbeitgeber_bestaetigt")),
      p("gebrochen", "anzeige"),
    ]);
    const ausZusage = promiseKept([
      ...Array(7).fill(p("gehalten", "arbeitgeber_bestaetigt")),
      p("gebrochen", "arbeitgeber_bestaetigt"),
    ]);
    expect(ausAnzeige.quote!).toBeGreaterThan(ausZusage.quote!);
  });
});

describe("Die Zählung bleibt immer sichtbar", () => {
  it("nennt jede Kategorie einzeln, auch ohne Quote", () => {
    const r = promiseKept([p("gehalten"), p("teilweise"), p("gebrochen"), p("zu_frueh")]);
    expect(r).toMatchObject({ gehalten: 1, teilweise: 1, gebrochen: 1, zuFrueh: 1, quote: null });
  });
});
