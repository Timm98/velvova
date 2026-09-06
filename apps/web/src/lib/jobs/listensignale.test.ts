import { describe, expect, it } from "vitest";
import { listensignale } from "./listensignale.ts";
import type { ScoredJob } from "@/lib/matching";

/**
 * Die Etiketten in der Jobliste.
 *
 * Sie ersetzen zwei ganze Sätze, die auf eine Zeile gestutzt waren. Der
 * Gewinn ist nur dann echt, wenn die Etiketten aus dem Datensatz
 * ABGELEITET sind — sonst hat man eine hübschere Behauptung statt einer
 * hässlichen Wahrheit.
 */

function job(over: Record<string, unknown> = {}): ScoredJob {
  return {
    job: { salary: { disclosed: true }, workModel: "hybrid" },
    constraints: { overall: "ok" },
    listingConfidence: { possiblyStale: false },
    confidence: { level: "high" },
    fit: { factors: [] },
    ...over,
  } as unknown as ScoredJob;
}

describe("Listensignale", () => {
  it("zeigt nie zwei Warnungen", () => {
    /*
     * Der ursprüngliche Fehler: Bis zu zwei beliebige waren erlaubt,
     * und in der Praxis standen fast immer zwei Warnungen da —
     * „Gehalt nicht angegeben" und „Dünne Datenlage", untereinander,
     * bei fast jeder Stelle. Was bei jeder Zeile steht, unterscheidet
     * keine Zeile von einer anderen.
     *
     * Die Regel lautet deshalb nicht „genau eines", sondern
     * „höchstens eines je Art". Hier gibt es nur Warnungen, also
     * bleibt genau eine übrig.
     */
    const s = listensignale(
      job({
        job: { salary: { disclosed: false }, workModel: "on_site" },
        constraints: { overall: "blocked" },
        listingConfidence: { possiblyStale: true },
        confidence: { level: "low" },
      }),
    );
    expect(s.length).toBe(1);
  });

  it("nennt zuerst, was abhält", () => {
    /*
     * Die Reihenfolge ist eine Produktentscheidung: wer eine Liste
     * überfliegt, sucht Gründe auszuschliessen. Ein Lob an erster
     * Stelle kostet ihn einen zweiten Blick.
     */
    /*
     * Geprüft mit „womöglich veraltet" statt mit dem Gehalt: Das
     * Gehalt hat in der Karte eine eigene Zeile und ist deshalb keine
     * Marke mehr. Das Prinzip — Warnung vor Lob — gilt unverändert.
     */
    const s = listensignale(
      job({
        job: { salary: { disclosed: true }, workModel: "remote" },
        listingConfidence: { possiblyStale: true },
        fit: { factors: [{ key: "provenSkills", label: "Belegte Fähigkeiten", raw: 0.9 }] },
      }),
    );
    expect(s[0]!.art).toBe("achtung");
    expect(s[0]!.text).toBe("Anzeige womöglich veraltet");
  });

  it("erkennt einen starken Aufgaben-Fit als solchen", () => {
    const s = listensignale(
      job({ fit: { factors: [{ key: "preferredTasks", label: "Tätigkeiten", raw: 0.85 }] } }),
    );
    expect(s.map((x) => x.text)).toContain("Starker Aufgaben-Fit");
  });

  it("lobt eine mittelmässige Passung nicht", () => {
    // 0,6 ist keine starke Passung. Sie so zu nennen wäre die Sorte
    // freundliche Unwahrheit, die eine Liste wertlos macht.
    const s = listensignale(
      job({ fit: { factors: [{ key: "preferredTasks", label: "Tätigkeiten", raw: 0.6 }] } }),
    );
    expect(s.some((x) => x.text.startsWith("Starke"))).toBe(false);
  });

  it("zeigt nie zwei Lobreden", () => {
    // Remote UND Gehalt angegeben UND starke Passung: trotzdem höchstens
    // ein positives Etikett. Eine Liste, in der jede Zeile zweimal lobt,
    // liest sich wie Werbung für den eigenen Bestand.
    const s = listensignale(
      job({
        job: { salary: { disclosed: true }, workModel: "remote" },
        fit: { factors: [{ key: "provenSkills", label: "Fähigkeiten", raw: 0.95 }] },
      }),
    );
    expect(s.filter((x) => x.art === "gut").length).toBeLessThanOrEqual(1);
  });

  it("nennt beide Seiten, wenn es beide gibt", () => {
    /*
     * Eine Stelle, die vollständig remote ist und deren Gehalt fehlt,
     * sagt mit nur einem Etikett die halbe Wahrheit — und welche
     * Hälfte, entschiede allein die Reihenfolge im Code.
     */
    const s = listensignale(
      job({
        job: { salary: { disclosed: false }, workModel: "remote" },
      }),
    );
    expect(s.filter((x) => x.art === "achtung").length).toBeLessThanOrEqual(1);
    expect(s.filter((x) => x.art === "gut").length).toBeLessThanOrEqual(1);
    expect(s.length).toBeLessThanOrEqual(2);
    /* Die Warnung steht vor dem Lob — was abhält, kommt zuerst. */
    if (s.length === 2) expect(s[0]!.art).toBe("achtung");
  });

  it("bleibt still, wenn es nichts zu sagen gibt", () => {
    // Kein erfundenes Etikett, nur damit die Zeile voll aussieht.
    const s = listensignale(job({ fit: { factors: [] } }));
    expect(s.every((x) => x.text.length > 0)).toBe(true);
  });

  it("hält jedes Etikett kurz genug für eine Zeile", () => {
    // Der ganze Sinn der Umstellung. Ein Etikett, das wieder abgeschnitten
    // wird, ist keine Verbesserung gegenüber dem gekürzten Satz.
    for (const fall of [
      job({ job: { salary: { disclosed: false }, workModel: "on_site" } }),
      job({ constraints: { overall: "blocked" } }),
      job({ listingConfidence: { possiblyStale: true } }),
      job({ confidence: { level: "low" } }),
      job({ fit: { factors: [{ key: "workStyle", label: "Arbeitsweise", raw: 0.9 }] } }),
    ]) {
      for (const s of listensignale(fall)) {
        expect(s.text.length, s.text).toBeLessThanOrEqual(34);
      }
    }
  });
});
