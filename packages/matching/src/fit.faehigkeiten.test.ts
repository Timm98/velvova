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
