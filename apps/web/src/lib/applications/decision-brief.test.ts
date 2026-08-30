import { describe, expect, it } from "vitest";
import { buildDecisionBrief, recommendationLabel } from "./decision-brief.ts";
import type { ScoredJob } from "@/lib/matching";

/**
 * Fünf getrennte Werte nebeneinander sind vollständig und trotzdem
 * keine Hilfe. Die Entscheidungsvorlage fasst sie zu dem zusammen, was
 * tatsächlich entschieden werden muss.
 */

function scored(over: Partial<{
  title: string;
  description: string;
  originalUrl: string | null;
  requirements: { text: string; kind: string }[];
  band: string;
  coverage: number;
  topReason: string;
  topReservation: string | null;
  blocked: boolean;
  scamLevel: string;
}> = {}): ScoredJob {
  return {
    job: {
      title: over.title ?? "Sachbearbeitung",
      description: over.description ?? "Unbefristet, Vollzeit, hybrid mit 2 Tagen im Büro, Gehalt 45.000 – 52.000 EUR, ab sofort, Team aus 6 Personen, Reiseanteil 5 %, keine Schichtarbeit.",
      originalUrl: over.originalUrl ?? "https://boards.greenhouse.io/x/jobs/1",
      applyMethod: "external",
      applyTarget: null,
    },
    requirements: over.requirements ?? [],
    fit: {
      band: over.band ?? "high",
      coverage: over.coverage ?? 0.7,
      topReason: over.topReason ?? "Deine Erfahrung im Kundenkontakt passt zu den Kernaufgaben.",
      topReservation: over.topReservation ?? null,
    },
    constraints: { overall: over.blocked ? "blocked" : "ok" },
    scam: { level: over.scamLevel ?? "normal_confidence", summary: "Nichts Auffälliges." },
  } as unknown as ScoredJob;
}

const brief = (s: ScoredJob, jahre: number | null = 4, c = {}) =>
  buildDecisionBrief({ scored: s, userYearsExperience: jahre, userConstraints: c });

describe("Empfehlung", () => {
  it("rät zum Bewerben bei guter Passung und klarer Anzeige", () => {
    expect(brief(scored()).recommendation).toBe("apply_now");
  });

  it("stellt einen harten Konflikt über alles andere", () => {
    // Ihn gegen eine gute Passung abzuwägen hiesse, die Bedingung der
    // Person zu überstimmen.
    const b = brief(
      scored({ description: "Reisebereitschaft von 60 % wird vorausgesetzt. Unbefristet, Vollzeit." }),
      4,
      { maxTravelPercent: 20 },
    );
    expect(b.recommendation).toBe("deprioritise");
  });

  it("stellt eine formale Sperre über eine gute Passung", () => {
    const b = brief(
      scored({ requirements: [{ text: "Führerschein Klasse C erforderlich", kind: "must" }] }),
    );
    expect(b.recommendation).toBe("deprioritise");
    expect(b.requirements.blocking).toHaveLength(1);
  });

  it("rät zum Klären, wenn zu viel unbekannt ist", () => {
    const b = brief(scored({ description: "Wir suchen Verstärkung für unser Team." }));
    expect(b.recommendation).toBe("clarify_first");
    expect(b.unknowns.length).toBeGreaterThan(0);
  });

  it("rät zu Belegen, wenn das Profil zu dünn ist", () => {
    expect(brief(scored({ coverage: 0.1 })).recommendation).toBe("build_evidence");
  });

  it("übersetzt jede Empfehlung in einen lesbaren Satz", () => {
    for (const r of ["apply_now", "clarify_first", "build_evidence", "deprioritise", "watch", "prepare_documents"] as const) {
      expect(recommendationLabel(r).length).toBeGreaterThan(5);
    }
  });
});

describe("Trennung der drei Listen", () => {
  it("mischt Unbekanntes nicht unter die Haken", () => {
    // Etwas nicht zu wissen ist kein Nachteil der Stelle — es ist eine
    // Lücke in unserer Kenntnis, und die Person kann sie schliessen.
    const b = brief(scored({ description: "Wir suchen Verstärkung." }));
    expect(b.unknowns.length).toBeGreaterThan(0);
    expect(b.catches.join(" ")).not.toMatch(/nicht angegeben|unbekannt/i);
  });

  it("nennt höchstens drei Gründe und drei Haken", () => {
    const b = brief(
      scored({
        description: "Reisebereitschaft 60 %. Drei-Schicht-System.",
        topReservation: "Das Gehalt liegt unter deiner Grenze.",
        scamLevel: "additional_verification_recommended",
        requirements: [{ text: "Führerschein Klasse C erforderlich", kind: "must" }],
      }),
      4,
      { maxTravelPercent: 20, noShiftWork: true },
    );
    expect(b.reasons.length).toBeLessThanOrEqual(3);
    expect(b.catches.length).toBeLessThanOrEqual(3);
  });

  it("führt eine Überschrift, die allein trägt", () => {
    const b = brief(scored());
    expect(b.headline.length).toBeGreaterThan(10);
  });
});

describe("Aufwand", () => {
  it("gehört zur Entscheidung, nicht zur Nachbetrachtung", () => {
    const b = brief(scored({ originalUrl: "https://muster.wd3.myworkdayjobs.com/jobs/1" }));
    expect(b.effort.level).toBe("hoch");
    expect(b.recommendation).toBe("prepare_documents");
    expect(b.catches.join(" ")).toMatch(/viel Zeit/);
  });
});
