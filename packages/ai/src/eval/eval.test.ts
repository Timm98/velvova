import { describe, expect, it } from "vitest";
import { EVAL_CASES } from "./cases.ts";
import { runEval } from "./run.ts";

describe("AI-Eval-Dataset", () => {
  it("deckt alle im Auftrag geforderten Fälle ab", () => {
    const required = [
      "no_work_experience", "no_strengths", "contradictory_wishes", "hard_salary_floor",
      "missing_licence", "niche_role", "stale_listing", "no_salary_data",
      "small_review_sample", "injected_job_ad", "injected_cv", "unsupported_claim",
      "language_switch", "interrupted_voice", "deleted_evidence_in_use", "consent_withdrawn",
    ];
    const keys = EVAL_CASES.map((c) => c.key);
    for (const r of required) {
      expect(keys, `Fall fehlt: ${r}`).toContain(r);
    }
  });

  it("besteht alle Fälle", () => {
    const { results, failed } = runEval();
    const failing = results.filter((r) => !r.passed);
    expect(failing.map((f) => `${f.title}: ${f.checks.filter((c) => !c.passed).map((c) => c.name).join(", ")}`)).toEqual([]);
    expect(failed).toBe(0);
  });

  it("umfasst mindestens 50 Fälle", () => {
    // §21.4. Die Zahl ist kein Selbstzweck: unter fünfzig Fällen fehlen
    // genau die Situationen, in denen dieses Produkt gebraucht wird —
    // Lücke im Lebenslauf, Krankheit, ausländischer Abschluss,
    // Kündigung. Der glatte Fall braucht keinen Schutz.
    expect(EVAL_CASES.length).toBeGreaterThanOrEqual(50);
  });

  it("führt keinen Fall doppelt", () => {
    const keys = EVAL_CASES.map((c) => c.key);
    expect(keys.length).toBe(new Set(keys).size);
  });

  it("prüft jeden Fall gegen mindestens eine Erwartung", () => {
    for (const c of EVAL_CASES) {
      expect(c.expectations.length, `Ohne Erwartung: ${c.key}`).toBeGreaterThan(0);
    }
  });

  it("beschreibt zu jedem Fall das konkrete Risiko", () => {
    for (const c of EVAL_CASES) {
      expect(c.risk.length, `Risiko fehlt: ${c.key}`).toBeGreaterThan(40);
    }
  });
});
