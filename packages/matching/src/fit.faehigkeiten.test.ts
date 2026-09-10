import { describe, expect, it } from "vitest";
import { computeFit } from "./fit.ts";
import { makeConstraints, makeEvidence, makeJob } from "./fixtures.ts";

/**
 * Der Katalogweg im Passungswert.
 *
 * Er entscheidet nur, wo eine Anforderung und eine belegte Fähigkeit
 * auf denselben Schlüssel fallen. Sonst bleibt es beim Wortvergleich —
 * und ohne Fähigkeiten ändert sich gar nichts.
 */

const KATALOG: Record<string, string> = {
  "erfahrung in der kommissionierung": "kommissionierung",
  "auftragszusammenstellung nach liste": "kommissionierung",
};
const schluesselFuerAnforderung = (t: string) => KATALOG[t.toLowerCase().trim()] ?? null;

function basis(anforderung: string) {
  return {
    job: makeJob({ coreTasks: ["Ware zusammenstellen"] }),
    requirements: [
      { id: "r1", jobId: "job-1", kind: "must" as const, text: anforderung, skillKey: null, category: "skill" },
    ],
    evidence: makeEvidence([
      { id: "ev-k", type: "skill" as const, statement: "Kommissionierung nach Pickliste, zwei Jahre" },
    ]),
    constraints: makeConstraints(),
    energisingTasks: [],
    drainingTasks: [],
    workStylePreferences: [],
    rankedValues: [],
    statedInterests: [],
  };
}

describe("Fähigkeiten im Passungswert", () => {
  it("ändert nichts, solange keine Fähigkeiten vorliegen", () => {
    const ohne = computeFit(basis("Auftragszusammenstellung nach Liste") as never);
    const leer = computeFit({
      ...basis("Auftragszusammenstellung nach Liste"),
      faehigkeiten: [],
      schluesselFuerAnforderung,
    } as never);
    const a = ohne.factors.find((f) => f.key === "proven_skills")?.raw;
    const b = leer.factors.find((f) => f.key === "proven_skills")?.raw;
    expect(b).toBe(a);
  });

  it("bringt zusammen, was dasselbe meint und anders heisst", () => {
    /*
     * „Auftragszusammenstellung" und „Kommissionierung nach Pickliste"
     * teilen kein Wort. Der Wortvergleich findet nichts, der Katalog
     * schon — und genau dafür gibt es ihn.
     */
    const ohne = computeFit(basis("Auftragszusammenstellung nach Liste") as never);
    const mit = computeFit({
      ...basis("Auftragszusammenstellung nach Liste"),
      faehigkeiten: [{ schluessel: "kommissionierung", stufe: "sicher" }],
      schluesselFuerAnforderung,
    } as never);
    const a = ohne.factors.find((f) => f.key === "proven_skills")!.raw ?? 0;
    const b = mit.factors.find((f) => f.key === "proven_skills")!.raw ?? 0;
    expect(b).toBeGreaterThan(a);
  });

  it("hebt nichts an, wofür der Katalog nichts kennt", () => {
    const mit = computeFit({
      ...basis("Erfahrung mit Quantenkryptografie"),
      faehigkeiten: [{ schluessel: "kommissionierung", stufe: "sicher" }],
      schluesselFuerAnforderung,
    } as never);
    const ohne = computeFit(basis("Erfahrung mit Quantenkryptografie") as never);
    expect(mit.factors.find((f) => f.key === "proven_skills")!.raw).toBe(
      ohne.factors.find((f) => f.key === "proven_skills")!.raw,
    );
  });

  it("hebt nichts an, was der Mensch nicht belegt hat", () => {
    /* Der Katalog kennt die Anforderung — die Person kann sie nicht. */
    const mit = computeFit({
      ...basis("Erfahrung in der Kommissionierung"),
      faehigkeiten: [{ schluessel: "ladungssicherung", stufe: "sicher" }],
      schluesselFuerAnforderung,
    } as never);
    const ohne = computeFit(basis("Erfahrung in der Kommissionierung") as never);
    expect(mit.factors.find((f) => f.key === "proven_skills")!.raw).toBe(
      ohne.factors.find((f) => f.key === "proven_skills")!.raw,
    );
  });
});

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Begründung — Anforderung → Fähigkeit → Beleg
 * ══════════════════════════════════════════════════════════════════
 *
 * Bis zum 11.09.2026 gab der Katalogweg eine nackte `1` zurück. Der
 * Wert wusste, DASS eine Anforderung gedeckt war, und nicht wodurch —
 * und wer eine unerklärte Zahl erklären soll, erfindet eine
 * Begründung. Diese Prüfungen halten die Kette zusammen.
 */
describe("Die Kette hinter dem Wert", () => {
  const belegteFaehigkeit = (stufe: string, belege: string[]) => ({
    schluessel: "kommissionierung",
    stufe,
    belegtDurch: belege,
    herkunft: "arbeitsprobe" as const,
  });

  it("nennt bei einer erfüllten Anforderung Fähigkeit und Beleg", () => {
    const f = computeFit({
      ...basis("Erfahrung in der Kommissionierung"),
      faehigkeiten: [belegteFaehigkeit("sicher", ["ev-k"])],
      schluesselFuerAnforderung,
    } as never);

    const b = f.anforderungsbefunde.find((x) => x.anforderung === "Erfahrung in der Kommissionierung")!;
    expect(b.stand).toBe("erfuellt");
    expect(b.schluessel).toBe("kommissionierung");
    expect(b.belege).toEqual(["ev-k"]);
    expect(b.satz).toContain("sicher");
  });

  it("erfindet keine Begründung, wo kein Beleg steht", () => {
    const f = computeFit({
      ...basis("Erfahrung in der Kommissionierung"),
      faehigkeiten: [{ ...belegteFaehigkeit("sicher", []), schluessel: "ladungssicherung" }],
      schluesselFuerAnforderung,
    } as never);

    const b = f.anforderungsbefunde[0]!;
    expect(b.stand).toBe("nicht_belegt");
    expect(b.belege).toEqual([]);
    /* Kein Satz, der eine Deckung behauptet. */
    expect(b.satz).not.toMatch(/belegt auf der stufe/i);
  });

  it("sagt „teilweise“, wenn die Stufe nicht reicht", () => {
    const f = computeFit({
      ...basis("Erfahrung in der Kommissionierung"),
      faehigkeiten: [belegteFaehigkeit("grundkenntnisse", ["ev-k"])],
      schluesselFuerAnforderung,
    } as never);

    const b = f.anforderungsbefunde[0]!;
    expect(b.stand).toBe("teilweise");
    expect(b.belege).toEqual(["ev-k"]);
    expect(b.satz).toContain("grundkenntnisse");
  });

  it("trägt in jedem erfüllten Befund mindestens einen Beleg", () => {
    const f = computeFit({
      ...basis("Erfahrung in der Kommissionierung"),
      faehigkeiten: [belegteFaehigkeit("anleitend", ["ev-k", "ev-2"])],
      schluesselFuerAnforderung,
    } as never);

    for (const b of f.anforderungsbefunde.filter((x) => x.stand === "erfuellt")) {
      expect(b.belege.length).toBeGreaterThan(0);
    }
  });

  it("ordnet ohne Katalog keinen Schlüssel zu", () => {
    const f = computeFit(basis("Erfahrung in der Kommissionierung") as never);
    for (const b of f.anforderungsbefunde) {
      expect(b.schluessel).toBeNull();
    }
  });

  it("stellt das Erfüllte vor das Fehlende", () => {
    const f = computeFit({
      job: makeJob({ coreTasks: ["Ware zusammenstellen"] }),
      requirements: [
        { id: "r1", jobId: "job-1", kind: "must" as const, text: "Auftragszusammenstellung nach Liste", skillKey: null, category: "skill" },
        { id: "r2", jobId: "job-1", kind: "must" as const, text: "Erfahrung in der Kommissionierung", skillKey: null, category: "skill" },
      ],
      evidence: makeEvidence([
        { id: "ev-k", type: "skill" as const, statement: "Kommissionierung nach Pickliste, zwei Jahre" },
      ]),
      constraints: makeConstraints(),
      energisingTasks: [],
      drainingTasks: [],
      workStylePreferences: [],
      rankedValues: [],
      statedInterests: [],
      faehigkeiten: [belegteFaehigkeit("sicher", ["ev-k"])],
      schluesselFuerAnforderung,
    } as never);

    expect(f.anforderungsbefunde).toHaveLength(2);
    expect(f.anforderungsbefunde[0]!.stand).toBe("erfuellt");
  });
});
