import { describe, expect, it } from "vitest";
import { BELEGGEWICHT, belegbilanz, belegstufe } from "./belegkraft.ts";

describe("belegstufe", () => {
  it("nennt eine Arbeitsprobe beobachtet", () => {
    expect(belegstufe("work_sample", true)).toBe("beobachtet");
  });

  it("nennt eine Selbstauskunft behauptet — auch wenn bestätigt", () => {
    /*
     * Etwas selbst zu bestätigen macht es nicht überprüfbar. Sonst
     * wäre jeder Lebenslauf belegt.
     */
    expect(belegstufe("user_stated", true)).toBe("behauptet");
    expect(belegstufe("user_confirmed", true)).toBe("behauptet");
  });

  it("nennt eine Vermutung des Modells nicht schwächer als eine Selbstauskunft", () => {
    /*
     * Eine Aussage wird nicht dadurch schlechter, dass eine Maschine
     * sie formuliert hat — und nicht dadurch besser.
     */
    expect(belegstufe("ai_hypothesis", false)).toBe(belegstufe("user_stated", false));
  });

  it("hebt einen Unterlagen-Auszug erst durch Bestätigung", () => {
    expect(belegstufe("document_extract", false)).toBe("behauptet");
    expect(belegstufe("document_extract", true)).toBe("bestaetigt");
  });

  it("lässt den Verlauf die Herkunft stechen", () => {
    /* Was hier trägt, ist die Zeit, nicht die Quelle. */
    expect(belegstufe("user_stated", false, "verlauf:teamarbeit")).toBe("berichtet");
  });

  it("gewichtet beobachtet deutlich über behauptet", () => {
    expect(BELEGGEWICHT.beobachtet).toBeGreaterThan(BELEGGEWICHT.behauptet * 3);
  });
});

describe("belegbilanz", () => {
  it("schweigt bei leerem Profil statt null zu behaupten", () => {
    const b = belegbilanz([]);
    expect(b.gesamt).toBe(0);
    expect(b.belegt).toBe(0);
  });

  it("zählt je Stufe und mittelt gewichtet", () => {
    const b = belegbilanz(["beobachtet", "behauptet"]);
    expect(b.gesamt).toBe(2);
    expect(b.beobachtet).toBe(1);
    expect(b.behauptet).toBe(1);
    expect(b.belegt).toBeCloseTo((1.0 + 0.3) / 2, 5);
  });

  it("gibt einem Profil aus lauter Selbstauskünften keine Null", () => {
    /*
     * Ungeprüft ist nicht wertlos. Ein Profil ohne Arbeitsproben ist
     * nicht schlechter, sondern nur nicht überprüft.
     */
    expect(belegbilanz(["behauptet", "behauptet"]).belegt).toBeGreaterThan(0);
  });
});
