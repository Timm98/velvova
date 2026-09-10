import { describe, expect, it } from "vitest";
/*
 * Direkt auf die Quellen, nicht über den Paketnamen: Tests im
 * Wurzelverzeichnis liegen ausserhalb der Arbeitsbereiche und lösen
 * `@paycheck/domain` nicht auf.
 */
import { anforderungenPruefen } from "../../../packages/domain/src/wunschprofil.ts";
import { aussagenPruefen } from "../../../packages/domain/src/arbeitsweise.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Pflichttest: geschützte Merkmale kommen nirgends durch
 * ══════════════════════════════════════════════════════════════════
 *
 * Zwei Wege führen in dieses Produkt hinein, an denen ein geschütztes
 * Merkmal zu einem Auswahlkriterium werden könnte:
 *
 *   Der Arbeitgeber sagt, wen er will  → `anforderungenPruefen`
 *   Der Mensch sagt, wie er arbeitet   → `aussagenPruefen`
 *
 * Beide Seiten meinen es ehrlich, und beide Sätze sind unzulässig. Der
 * Unterschied liegt nur darin, wer ihn sagt.
 *
 * ── Warum das ein gemeinsamer Test ist ──────────────────────────
 *
 * Weil die beiden Filter getrennt entstanden sind und getrennt
 * verrotten würden. Ein Merkmal, das auf einer Seite ergänzt wird und
 * auf der anderen nicht, ist eine offene Tür, die niemand sieht.
 */

const MERKMALE: readonly { arbeitgeber: string; mensch: string; name: string }[] = [
  { name: "Alter", arbeitgeber: "nicht über 50 Jahre", mensch: "Mit 58 Jahren fange ich nicht mehr neu an" },
  { name: "Gesundheit", arbeitgeber: "muss gesund sein", mensch: "Wegen meiner Bandscheibe geht das nicht" },
  { name: "Familie", arbeitgeber: "keine Mütter", mensch: "Ich hole meine Kinder um vier ab" },
  { name: "Herkunft", arbeitgeber: "deutscher Muttersprachler", mensch: "Wegen meiner Herkunft habe ich es schwerer" },
  { name: "Religion", arbeitgeber: "kein Kopftuch", mensch: "Ich gehe sonntags in die Kirche" },
];

describe("Pflichttest: geschützte Merkmale", () => {
  for (const m of MERKMALE) {
    it(`hält ${m.name} aus dem Angebot des Arbeitgebers`, () => {
      const { bleiben, gestrichen } = anforderungenPruefen([m.arbeitgeber]);
      expect(bleiben, m.arbeitgeber).toHaveLength(0);
      expect(gestrichen, m.arbeitgeber).toHaveLength(1);
    });

    it(`hält ${m.name} aus dem Profil des Menschen`, () => {
      const { bleiben, ausgeschlossen } = aussagenPruefen([m.mensch]);
      expect(bleiben, m.mensch).toHaveLength(0);
      expect(ausgeschlossen, m.mensch).toHaveLength(1);
    });
  }

  it("lässt fachliche Aussagen auf beiden Seiten stehen", () => {
    /*
     * Ein Filter, der alles streicht, erfüllt diesen Test auch — und
     * macht das Produkt unbrauchbar. Deshalb die Gegenprobe.
     */
    expect(anforderungenPruefen(["Erfahrung mit Wärmepumpen"]).gestrichen).toEqual([]);
    expect(aussagenPruefen(["Ich arbeite am besten mit festem Plan"]).ausgeschlossen).toEqual([]);
  });
});
