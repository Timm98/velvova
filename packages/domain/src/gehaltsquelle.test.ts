import { describe, expect, it } from "vitest";
import { GEHALTSQUELLEN, QUELLENTEXT, vomArbeitgeber } from "./gehaltsquelle.ts";

describe("Gehaltsquellen", () => {
  it("trennt Angabe von Schätzung", () => {
    /*
     * Der Filter „ab 45.000, wenn angegeben" wäre wertlos, wenn eine
     * Schätzung ihn erfüllte — fast jede Stelle hat eine.
     */
    expect(vomArbeitgeber("arbeitgeber")).toBe(true);
    expect(vomArbeitgeber("aus_text")).toBe(true);
    expect(vomArbeitgeber("amtlich_beruf")).toBe(false);
    expect(vomArbeitgeber("amtlich_gruppe")).toBe(false);
    expect(vomArbeitgeber("portal")).toBe(false);
  });

  it("nennt bei jeder Quelle, was die Zahl ist", () => {
    for (const q of GEHALTSQUELLEN) {
      expect(QUELLENTEXT[q].kurz.length, q).toBeGreaterThan(3);
      expect(QUELLENTEXT[q].lang.length, q).toBeGreaterThan(40);
    }
  });

  it("sagt bei der Schätzung ausdrücklich, dass sie nichts über die Stelle sagt", () => {
    expect(QUELLENTEXT.amtlich_beruf.lang).toContain("Über diese Stelle sagt sie nichts");
  });

  it("nennt das Portal nicht Arbeitgeberangabe", () => {
    /*
     * Ein Portal reicht Zahlen weiter, ohne dass erkennbar ist, woher
     * sie stammen. Das als Angabe zu zählen wäre die bequeme Lesart.
     */
    expect(QUELLENTEXT.portal.kurz).not.toContain("Arbeitgeber");
  });
});
