import { describe, expect, it } from "vitest";
import { blätterstand } from "./blaettern.ts";

const PRO_SEITE = 25;

describe("Blättern", () => {
  it("zeigt die letzte Seite statt einer leeren, wenn die Liste kürzer wurde", () => {
    /*
     * Der gemeldete Fehler, als Test.
     *
     * 14 Treffer sind eine Seite. Steht `seite=4` in der Adresse — weil
     * jemand geblättert und dann gefiltert hat —, darf nicht Seite 4
     * gezeigt werden. Sonst behauptet die Oberfläche, es gäbe nichts.
     */
    const s = blätterstand(14, "4", PRO_SEITE);
    expect(s.seite).toBe(1);
    expect(s.seitenGesamt).toBe(1);
    expect(s.bis - s.von, "alle 14 sind zu sehen").toBe(14);
  });

  it("blättert normal, solange die Seite existiert", () => {
    const s = blätterstand(243, "2", PRO_SEITE);
    expect(s.seite).toBe(2);
    expect(s.seitenGesamt).toBe(10);
    expect(s.von).toBe(25);
    expect(s.bis).toBe(50);
  });

  it("schneidet die letzte Seite auf den Rest zu", () => {
    // 243 = neun volle Seiten und ein Rest von 18.
    const s = blätterstand(243, "10", PRO_SEITE);
    expect(s.von).toBe(225);
    expect(s.bis).toBe(243);
  });

  it("landet bei Unsinn in der Adresse auf Seite 1", () => {
    for (const eingabe of ["0", "-3", "abc", "", null, undefined, "1e999", "3.7"]) {
      const s = blätterstand(243, eingabe, PRO_SEITE);
      expect(s.seite, `bei ${JSON.stringify(eingabe)}`).toBeGreaterThanOrEqual(1);
      expect(s.seite, `bei ${JSON.stringify(eingabe)}`).toBeLessThanOrEqual(s.seitenGesamt);
    }
  });

  it("kommt mit einer leeren Liste zurecht", () => {
    const s = blätterstand(0, "5", PRO_SEITE);
    expect(s.seite).toBe(1);
    expect(s.seitenGesamt).toBe(1);
    expect(s.von).toBe(0);
    expect(s.bis).toBe(0);
  });

  it("zeigt jede Stelle genau einmal", () => {
    /*
     * Keine doppelten Jobs, keine Lücken (§17.1). Über alle Seiten
     * gelegt muss jeder Index genau einmal vorkommen — ein
     * Off-by-one hier wäre in der Oberfläche eine Stelle, die auf
     * zwei Seiten steht oder auf keiner.
     */
    const anzahl = 243;
    const gesehen: number[] = [];
    const { seitenGesamt } = blätterstand(anzahl, 1, PRO_SEITE);
    for (let s = 1; s <= seitenGesamt; s++) {
      const { von, bis } = blätterstand(anzahl, String(s), PRO_SEITE);
      for (let i = von; i < bis; i++) gesehen.push(i);
    }
    expect(gesehen.length).toBe(anzahl);
    expect(new Set(gesehen).size, "keine Dopplungen").toBe(anzahl);
  });
});
