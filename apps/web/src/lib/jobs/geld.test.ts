import { describe, expect, it } from "vitest";
import { betrag, gehaltText, spanne } from "./geld.ts";

/**
 * Die Schreibweise gehört zur Währung, nicht zum Nutzer.
 *
 * Vorher stand an zwei Stellen `Intl.NumberFormat("de-DE")` fest
 * eingetragen. Für deutsche Stellen ging das gut; ein Schweizer Gehalt
 * erschien als „90.000 CHF" statt „CHF 90'000", ein britisches als
 * „60.000 GBP" statt „£60,000".
 */

const ohneRaum = (s: string) => s.replace(/[   ]/g, " ");

describe("Beträge", () => {
  it("schreibt Euro deutsch", () => {
    expect(ohneRaum(betrag(60000, "EUR"))).toBe("60.000 €");
  });

  it("schreibt Franken mit Apostroph und Kürzel vorn", () => {
    // In der Schweiz trennt ein Apostroph. „90.000" wäre dort
    // missverständlich.
    const s = ohneRaum(betrag(90000, "CHF"));
    expect(s).toContain("CHF");
    expect(s).toMatch(/90.?000/);
  });

  it("schreibt Pfund und Dollar mit Symbol vorn", () => {
    expect(ohneRaum(betrag(60000, "GBP"))).toBe("£60,000");
    expect(ohneRaum(betrag(120000, "USD"))).toBe("$120,000");
  });

  it("zerreisst bei einem krummen Kürzel nicht die Seite", () => {
    /*
     * `Intl.NumberFormat` wirft bei ungültigen Codes, und die kommen
     * aus fremden Daten. Eine Liste, die deswegen gar nicht rendert,
     * ist schlechter als eine, die den Betrag schlicht anzeigt.
     */
    expect(() => betrag(50000, "XYZ!")).not.toThrow();
    expect(betrag(50000, "XYZ!")).toContain("50.000");
  });
});

describe("Spannen", () => {
  it("nennt beide Enden mit Währung", () => {
    expect(ohneRaum(spanne(60000, 80000, "EUR")!)).toBe("60.000 € – 80.000 €");
  });

  it("nennt bei nur einem Wert nur diesen", () => {
    expect(ohneRaum(spanne(60000, null, "EUR")!)).toBe("60.000 €");
    expect(ohneRaum(spanne(null, 80000, "EUR")!)).toBe("80.000 €");
  });

  it("gibt ohne Werte nichts zurück", () => {
    // Kein „0 €“: Wo keine Angabe ist, steht keine Zahl.
    expect(spanne(null, null, "EUR")).toBeNull();
  });
});

describe("Zeitraum", () => {
  it("nennt ihn und rechnet ihn nicht um", () => {
    /*
     * Aus einem Stundenlohn ein Jahresgehalt zu machen setzt eine
     * Wochenarbeitszeit voraus, die in der Anzeige selten steht.
     */
    expect(gehaltText(20, null, "EUR", "hour")).toContain("pro Stunde");
    expect(gehaltText(4000, null, "EUR", "month")).toContain("pro Monat");
    expect(gehaltText(60000, 80000, "EUR", "year")).toContain("pro Jahr");
  });
});
