import { describe, expect, it } from "vitest";
import { kostenCent, preistafel, PREIS_VORGABE } from "./preise.ts";

describe("Preistafel", () => {
  it("nimmt hinterlegte Preise", () => {
    const { tafel, hinterlegt } = preistafel({
      AI_PREIS_INPUT_CENT_PRO_MTOKEN: "100",
      AI_PREIS_OUTPUT_CENT_PRO_MTOKEN: "400",
    });
    expect(hinterlegt).toBe(true);
    expect(tafel).toEqual({ inputCentProMillion: 100, outputCentProMillion: 400 });
  });

  it("nimmt die Vorgabe, wenn nur eine Zahl hinterlegt ist", () => {
    /*
     * Eine halb hinterlegte Tafel wäre eine Mischung aus echtem und
     * geschätztem Preis — und die liesse sich hinterher nicht deuten.
     */
    const { tafel, hinterlegt } = preistafel({ AI_PREIS_INPUT_CENT_PRO_MTOKEN: "100" });
    expect(hinterlegt).toBe(false);
    expect(tafel).toEqual(PREIS_VORGABE);
  });

  it("nimmt die Vorgabe bei Unsinn", () => {
    expect(preistafel({ AI_PREIS_INPUT_CENT_PRO_MTOKEN: "viel", AI_PREIS_OUTPUT_CENT_PRO_MTOKEN: "-3" }).hinterlegt).toBe(
      false,
    );
  });
});

describe("Kosten", () => {
  const tafel = { inputCentProMillion: 100, outputCentProMillion: 400 };

  it("rechnet aus Tokens", () => {
    /* 100.000 Eingabe + 10.000 Ausgabe = 10 + 4 = 14 Cent. */
    expect(kostenCent(100_000, 10_000, tafel, true).cent).toBe(14);
  });

  it("rundet auf, statt einen kleinen Aufruf als kostenlos zu zählen", () => {
    /* Tausend Aufrufe zu 0,3 Cent sind drei Euro. */
    expect(kostenCent(1_000, 100, tafel, true).cent).toBe(1);
  });

  it("zählt auch ohne gemeldete Tokens etwas", () => {
    /*
     * Der Fall, in dem ein Budget lautlos aufhört zu wirken: Der
     * Anbieter meldet nichts, jeder Aufruf kostet 0, die Grenze greift
     * nie.
     */
    const befund = kostenCent(null, null, tafel, true);
    expect(befund.cent).toBeGreaterThan(0);
    expect(befund.geschaetzt).toBe(true);
  });

  it("vermerkt, wenn mit der Vorgabe gerechnet wurde", () => {
    expect(kostenCent(1000, 100, PREIS_VORGABE, false).geschaetzt).toBe(true);
    expect(kostenCent(1000, 100, tafel, true).geschaetzt).toBe(false);
  });
});
