import { describe, expect, it } from "vitest";
import { needsSummary, SUMMARISE_AFTER, VERBATIM_TURNS } from "./conversations.ts";

describe("needsSummary", () => {
  it("schweigt bei einem kurzen Gespräch", () => {
    expect(needsSummary(5, 0)).toBe(false);
  });

  it("schlägt an, sobald genug Neues dazugekommen ist", () => {
    expect(needsSummary(SUMMARISE_AFTER, 0)).toBe(true);
    expect(needsSummary(SUMMARISE_AFTER - 1, 0)).toBe(false);
  });

  it("misst den Abstand zur letzten Verdichtung, nicht die Gesamtlänge", () => {
    /*
     * Sonst liefe die Verdichtung in einem langen Gespräch bei jedem
     * einzelnen Zug — und jeder Zug kostete einen zusätzlichen
     * Modellaufruf für dieselbe Erinnerung.
     */
    expect(needsSummary(100, 95)).toBe(false);
    expect(needsSummary(100, 80)).toBe(true);
  });

  it("lässt die wörtlichen Züge unverdichtet", () => {
    /*
     * Die letzten Züge gehen ohnehin im Wortlaut mit. Würde die
     * Verdichtung bis zum letzten Zug reichen, stünde dasselbe zweimal
     * im Zusammenhang.
     */
    expect(VERBATIM_TURNS).toBeGreaterThan(0);
    expect(SUMMARISE_AFTER).toBeGreaterThan(VERBATIM_TURNS);
  });
});
