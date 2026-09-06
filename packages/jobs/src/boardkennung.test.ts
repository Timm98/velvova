import { describe, expect, it } from "vitest";
import { boardkennungen } from "./boardkennung.ts";

/**
 * Aus einem Firmennamen eine Board-Kennung raten.
 *
 * Jede geratene Kennung ist eine Anfrage bei einem fremden Dienst, und
 * 96 % davon gehen ins Leere. Zwei Dinge müssen deshalb stimmen: Die
 * wahrscheinlichste Variante muss zuerst kommen, und es dürfen nicht
 * beliebig viele sein.
 */

describe("Kennungen raten", () => {
  it("trifft die gemessenen Beispiele", () => {
    // Beide echt gefunden bei der Stichprobe über 50 Arbeitgeber.
    expect(boardkennungen("gocomo GmbH")[0]).toBe("gocomo");
    expect(boardkennungen("WOHN-UNION GmbH")[0]).toBe("wohn-union");
  });

  it("wirft Rechtsformen weg", () => {
    for (const n of ["Muster GmbH", "Muster AG", "Muster GmbH & Co. KG", "Muster SE"]) {
      expect(boardkennungen(n)[0], n).toBe("muster");
    }
  });

  it("schreibt Umlaute um", () => {
    // Eine Kennung mit Umlaut gibt es in keiner Adresse.
    expect(boardkennungen("Müller Söhne GmbH")[0]).toBe("mueller-soehne");
    expect(boardkennungen("Grüße GmbH")[0]).not.toMatch(/[äöüß]/);
  });

  it("bietet mehrere Schreibweisen an, die wahrscheinlichste zuerst", () => {
    const k = boardkennungen("Muster Technik GmbH");
    expect(k[0]).toBe("muster-technik");
    expect(k).toContain("mustertechnik");
    expect(k).toContain("muster");
  });

  it("gibt höchstens drei zurück", () => {
    /*
     * Jede weitere Variante ist eine Anfrage mehr für eine immer
     * unwahrscheinlichere Vermutung. Bei 50.000 Arbeitgebern ist der
     * Unterschied zwischen drei und sechs Varianten 150.000 Anfragen.
     */
    const k = boardkennungen("Erste Zweite Dritte Vierte Fünfte Technik Holding GmbH");
    expect(k.length).toBeLessThanOrEqual(3);
  });

  it("gibt bei einem unbrauchbaren Namen nichts zurück", () => {
    for (const n of ["GmbH", "AG", "  ", "&", "e.V."]) {
      expect(boardkennungen(n), n).toEqual([]);
    }
  });

  it("wiederholt keine Variante", () => {
    const k = boardkennungen("Muster GmbH");
    expect(new Set(k).size).toBe(k.length);
  });
});
