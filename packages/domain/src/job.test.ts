import { describe, expect, it } from "vitest";
import { SalarySchema } from "./job.ts";

describe("Gehalt mit Nachkommastellen", () => {
  /**
   * Stundenlöhne sind fast nie ganzzahlig — der gesetzliche
   * Mindestlohn ist 12,82 €. Mit `.int()` im Schema fiel jede solche
   * Anzeige durch, und zwar leise: ein verworfenes Gehalt sieht in der
   * Oberfläche genauso aus wie ein nicht angegebenes.
   */
  it("nimmt einen krummen Stundenlohn an", () => {
    const s = SalarySchema.parse({
      min: 12.82,
      max: 17.65,
      currency: "EUR",
      period: "hour",
      disclosed: true,
      provenance: "employer",
    });
    expect(s.min).toBe(12.82);
    expect(s.max).toBe(17.65);
  });

  it("weist einen negativen Betrag weiter zurück", () => {
    // Gelockert wurde nur die Ganzzahligkeit, nicht die Plausibilität.
    expect(() =>
      SalarySchema.parse({ min: -1, max: null, disclosed: true, provenance: "employer" }),
    ).toThrow();
  });
});
