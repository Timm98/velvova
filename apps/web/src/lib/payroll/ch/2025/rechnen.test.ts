import { describe, expect, it } from "vitest";
import { bundessteuer, kantonRechenbar, steuerBerechnen } from "./rechnen.ts";
import { STEUERFUESSE_2025, satzFuer } from "./steuerfuesse.ts";

/* Die von der Vorgabe verlangten Stützstellen. */
const EINKOMMEN = [20_000, 50_000, 80_000, 100_000, 150_000, 250_000, 500_000];

describe("direkte Bundessteuer 2026 — Grundtarif", () => {
  /**
   * Jeder Erwartungswert ist von Hand aus dem Gesetzestext gerechnet,
   * nicht aus dem Code übernommen. Ein Test, der das Ergebnis der
   * Funktion als Erwartung einsetzt, prüft nur, dass sie sich nicht
   * ändert — nicht, dass sie stimmt.
   *
   *   20'000 : Stufe ab 15'200, (20'000-15'200)/100 = 48 x 0.77
   *   50'000 : Stufe ab 43'500, 229.20 + 65 x 2.64
   *  100'000 : Stufe ab 82'100, 1'502.95 + 179 x 6.60
   *  500'000 : Stufe ab 185'100, 10'936.55 + 3149 x 13.20
   */
  it.each([
    [20_000, 48 * 0.77],
    [50_000, 229.2 + 65 * 2.64],
    [80_000, 1152.55 + 38 * 5.94],
    [100_000, 1502.95 + 179 * 6.6],
    [150_000, 6140.55 + 85 * 11.0],
    [250_000, 10936.55 + 649 * 13.2],
    [500_000, 10936.55 + 3149 * 13.2],
  ])("bei %i Franken", (einkommen, erwartet) => {
    expect(bundessteuer(einkommen, "single")).toBeCloseTo(Math.round(erwartet * 100) / 100, 2);
  });

  it("erhebt unter der ersten Stufe nichts", () => {
    expect(bundessteuer(15_200, "single")).toBe(0);
    expect(bundessteuer(10_000, "single")).toBe(0);
  });

  it("trifft die Stützpunkte der amtlichen Tabelle", () => {
    /*
     * Nicht gerechnet, sondern abgelesen: Diese Werte stehen so in
     * Form. 58c der ESTV. Sie sind der Grund, warum die erste Fassung
     * dieser Datei verworfen wurde — sie stammte aus einer veralteten
     * Gesetzesfassung und lag bei jedem einzelnen daneben.
     */
    expect(bundessteuer(18_500, "single")).toBeCloseTo(25.41, 2);
    expect(bundessteuer(20_000, "single")).toBeCloseTo(36.96, 2);
    expect(bundessteuer(33_200, "single")).toBeCloseTo(138.6, 2);
    expect(bundessteuer(58_000, "single")).toBeCloseTo(612.0, 2);
    expect(bundessteuer(108_900, "single")).toBeCloseTo(3271.75, 2);
    expect(bundessteuer(141_500, "single")).toBeCloseTo(6140.55, 2);
  });

  it("deckelt hohe Einkommen bei 11,5 Prozent des Ganzen", () => {
    /*
     * Oberhalb 793'900 gilt nicht der Grenzsatz auf den Überschuss,
     * sondern 11,5 Prozent auf das GESAMTE Einkommen. Wer das
     * vergisst, verlangt bei zwei Millionen rund 40'000 zu viel.
     */
    expect(bundessteuer(2_000_000, "single")).toBe(230_000);
  });

  it("ist am Übergang zur Deckelung stetig", () => {
    /* Der Stufentarif erreicht bei 793'900 genau 91'298.15, die
       Deckelung ergibt 91'310.00 — ein Sprung von Rappen, nicht von
       Franken. */
    const davor = bundessteuer(793_900, "single");
    const danach = bundessteuer(794_000, "single");
    expect(Math.abs(danach - davor)).toBeLessThan(30);
  });

  it("rechnet je volle hundert Franken, nicht je angefangene", () => {
    /* 105'550 wird wie 105'500 besteuert — aufgerundet ergäbe das
       eine Steuer, die niemand schuldet. */
    expect(bundessteuer(105_550, "single")).toBe(bundessteuer(105_500, "single"));
    expect(bundessteuer(105_600, "single")).toBeGreaterThan(bundessteuer(105_500, "single"));
  });
});

describe("direkte Bundessteuer 2026 — Verheiratetentarif", () => {
  it.each([
    [20_000, 0],
    [50_000, 203 * 1.0],
    [80_000, 929 + 9 * 4.0],
    [100_000, 1561 + 51 * 5.0],
    [150_000, 5221 + 17 * 11.0],
    [250_000, 5692 + 976 * 13.0],
    [500_000, 5692 + 3476 * 13.0],
  ])("bei %i Franken", (einkommen, erwartet) => {
    expect(bundessteuer(einkommen, "married")).toBeCloseTo(Math.round(erwartet * 100) / 100, 2);
  });

  it("beginnt später als der Grundtarif", () => {
    /* 29'700 statt 15'200 — das ist der Kern des Splittings. */
    expect(bundessteuer(29_700, "married")).toBe(0);
    expect(bundessteuer(29_700, "single")).toBeGreaterThan(0);
  });

  it("trifft die Stützpunkte der amtlichen Tabelle", () => {
    expect(bundessteuer(33_000, "married")).toBeCloseTo(33.0, 2);
    expect(bundessteuer(53_400, "married")).toBeCloseTo(237.0, 2);
    expect(bundessteuer(79_200, "married")).toBeCloseTo(933.0, 2);
    expect(bundessteuer(94_900, "married")).toBeCloseTo(1561.0, 2);
    expect(bundessteuer(152_400, "married")).toBeCloseTo(5692.0, 2);
  });

  it("findet die Kante bei 79'100, nicht bei 79'200", () => {
    /*
     * Der einzige Hinweis war ein Franken: Ab 79'200 gerechnet ergab
     * sich 932.00, die Tabelle nennt 933.00. Die Kante liegt hundert
     * Franken tiefer.
     */
    expect(bundessteuer(79_100, "married")).toBeCloseTo(929.0, 2);
    expect(bundessteuer(79_200, "married")).toBeCloseTo(933.0, 2);
  });

  it("deckelt bei 941'300", () => {
    expect(bundessteuer(941_400, "married")).toBeCloseTo(108_261.0, 2);
  });
});

describe("Elterntarif", () => {
  it("zieht 263 Franken je Kind von der STEUER ab", () => {
    /*
     * Nicht vom Einkommen. Der Unterschied wird regelmässig
     * verwechselt und ändert das Ergebnis um ein Vielfaches: 263
     * Franken weniger Steuer gegen 263 Franken weniger Einkommen,
     * das mit 5 Prozent besteuert wird — Faktor zwanzig.
     */
    const ohne = bundessteuer(100_000, "married");
    expect(bundessteuer(100_000, "parent", 2)).toBeCloseTo(ohne - 526, 2);
  });

  it("erstattet nichts, wenn der Abzug die Steuer übersteigt", () => {
    /* Ein Kinderabzug macht aus einer Steuer keine Auszahlung. */
    expect(bundessteuer(30_000, "parent", 5)).toBe(0);
  });

  it("benutzt den Verheiratetentarif als Grundlage", () => {
    expect(bundessteuer(100_000, "parent", 0)).toBe(bundessteuer(100_000, "married"));
  });
});

describe("die Steuerfüsse", () => {
  it("führt alle 26 Kantone", () => {
    expect(STEUERFUESSE_2025).toHaveLength(26);
    const codes = new Set(STEUERFUESSE_2025.map((s) => s.kanton));
    for (const c of "AG AI AR BE BL BS FR GE GL GR JU LU NE NW OW SG SH SO SZ TG TI UR VD VS ZG ZH".split(" ")) {
      expect(codes.has(c)).toBe(true);
    }
  });

  it("hält Zürich und Basel-Stadt wie in der ESTV-Tabelle", () => {
    expect(satzFuer("ZH")?.kanton_fuss).toBe(0.98);
    expect(satzFuer("ZH")?.gemeinde_fuss).toBe(1.19);
    /* Basel-Stadt: die 100 Prozent sind bereits die Summe aus
       Kanton (50 %) und Stadt (50 %). */
    expect(satzFuer("BS")?.kanton_fuss).toBe(1.0);
    expect(satzFuer("BS")?.gemeinde_fuss).toBe(0);
  });

  it("lässt unbekannte Füsse null, statt sie zu raten", () => {
    /* Bei BL und VS steht in der Quelle eine Fussnote statt einer
       Zahl. Null wäre eine Steuer von null Franken — und das sähe
       aus wie ein Ergebnis. */
    expect(satzFuer("BL")?.kanton_fuss).toBeNull();
    expect(satzFuer("VS")?.kanton_fuss).toBeNull();
  });
});

describe("was der Rechner ehrlich verweigert", () => {
  it("nennt den Grund, wenn der Steuerfuss fehlt", () => {
    const bl = kantonRechenbar("BL");
    expect(bl.moeglich).toBe(false);
    expect(bl.grund).toMatch(/Fussnote/);
  });

  it("nennt den Grund, wenn der Kantonstarif fehlt", () => {
    const be = kantonRechenbar("BE");
    expect(be.moeglich).toBe(false);
    expect(be.grund).toMatch(/Tarif/);
  });

  it("gibt null zurück, statt mit einem Standardtarif zu rechnen", () => {
    /*
     * Die Vorgabe ist ausdrücklich: keine geschätzten Steuersätze,
     * keine erfundenen Tarifstufen. Eine Zahl aus einem fehlenden
     * Tarif wäre beides.
     */
    for (const e of EINKOMMEN) {
      expect(steuerBerechnen("BE", e)).toBeNull();
    }
  });

  it("weist ein Land zurück, das kein Kanton ist", () => {
    expect(kantonRechenbar("DE").moeglich).toBe(false);
    expect(steuerBerechnen("DE", 100_000)).toBeNull();
  });
});
