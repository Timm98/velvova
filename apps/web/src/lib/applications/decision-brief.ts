import { assessSeniority, levelFromTitle, levelFromYears, type SeniorityAssessment } from "@/lib/experience/seniority-alignment";
import { classifyRequirement, summariseRequirements, type ClassifiedRequirement } from "@/lib/experience/requirement-classifier";
import { estimateEffort, type EffortEstimate } from "./effort-estimator";
import { buildPreflight, type PreflightResult } from "@/lib/process/condition-matrix";
import type { ScoredJob } from "@/lib/matching";

/**
 * Die Entscheidungsvorlage.
 *
 * Fünf Fragen, in der Reihenfolge, in der ein Mensch sie stellt:
 *
 *   Warum überhaupt ansehen?
 *   Was könnte nicht passen?
 *   Was weiss ich noch nicht?
 *   Was kostet mich eine Bewerbung?
 *   Was ist der nächste Schritt?
 *
 * Sie ersetzt keine der bestehenden Bewertungen — sie fasst sie zu dem
 * zusammen, was tatsächlich entschieden werden muss. Fünf getrennte
 * Werte nebeneinander sind vollständig und trotzdem keine Hilfe.
 */

export type Recommendation =
  | "apply_now"
  | "clarify_first"
  | "prepare_documents"
  | "build_evidence"
  | "watch"
  | "deprioritise";

export interface DecisionBrief {
  reasons: string[];
  catches: string[];
  unknowns: string[];
  effort: EffortEstimate;
  requirements: {
    classified: ClassifiedRequirement[];
    blocking: ClassifiedRequirement[];
    summary: string;
  };
  seniority: SeniorityAssessment;
  preflight: PreflightResult;
  recommendation: Recommendation;
  /** Ein Satz. Er steht ganz oben und muss allein tragen. */
  headline: string;
}

const EMPFEHLUNG_TEXT: Record<Recommendation, string> = {
  apply_now: "Jetzt bewerben",
  clarify_first: "Erst eine Frage klären",
  prepare_documents: "Unterlagen vorbereiten",
  build_evidence: "Erst Belege aufbauen",
  watch: "Für später beobachten",
  deprioritise: "Nicht priorisieren",
};

export function buildDecisionBrief(input: {
  scored: ScoredJob;
  userYearsExperience: number | null;
  userConstraints?: Parameters<typeof buildPreflight>[0]["userConstraints"];
}): DecisionBrief {
  const { scored } = input;
  const job = scored.job;

  const classified = scored.requirements.map((r) => classifyRequirement(r.text, r.kind));
  const reqSummary = summariseRequirements(classified);

  const seniority = assessSeniority({
    userLevel: levelFromYears(input.userYearsExperience),
    jobLevel: levelFromTitle(job.title),
  });

  const effort = estimateEffort({
    applyMethod: job.applyMethod,
    applyTarget: job.applyTarget,
    originalUrl: job.originalUrl,
    requirements: classified,
  });

  const preflight = buildPreflight({
    // Der Entscheidungsbericht entsteht immer für eine geöffnete Stelle,
    // und die kommt aus `loadScoredJob` — mit Text. Das `?? ""` ist die
    // Absicherung für den Fall, dass jemand ihn später aus der Liste
    // heraus aufruft: dann fehlen Hinweise, statt dass es abstürzt.
    description: job.description ?? "",
    userConstraints: input.userConstraints,
  });

  // ── Gründe ──────────────────────────────────────────────────
  const reasons: string[] = [];
  if (scored.fit.topReason) reasons.push(scored.fit.topReason);
  if (reqSummary.blocking.length === 0) {
    reasons.push("Keine formale Sperre in den Anforderungen.");
  }
  if (effort.level === "gering") {
    reasons.push(`Die Bewerbung kostet wenig Zeit (${effort.minutesMin}–${effort.minutesMax} Min.).`);
  }
  if (seniority.status === "aligned") reasons.push(seniority.headline);

  // ── Haken ───────────────────────────────────────────────────
  const catches: string[] = [];
  if (scored.fit.topReservation) catches.push(scored.fit.topReservation);
  for (const b of reqSummary.blocking) catches.push(`${b.text} — ${b.rationale}`);
  for (const c of preflight.conflicts) catches.push(c.explanation);
  if (seniority.status === "potentially_overqualified" || seniority.status === "entry_gap") {
    catches.push(seniority.headline);
  }
  if (effort.level === "hoch") {
    catches.push(`Die Bewerbung kostet viel Zeit (${effort.minutesMin}–${effort.minutesMax} Min.).`);
  }
  if (scored.scam?.level === "additional_verification_recommended") {
    catches.push(scored.scam.summary);
  }

  // ── Unbekanntes ─────────────────────────────────────────────
  //
  // Bewusst nicht in „Haken" gemischt. Etwas nicht zu wissen ist kein
  // Nachteil der Stelle — es ist eine Lücke in unserer Kenntnis, und
  // die Person kann sie schliessen.
  const unknowns = preflight.unclear.map((u) => u.label);
  if (effort.level === "unbekannt") unknowns.push("Bewerbungsaufwand");
  if (seniority.status === "unclear") unknowns.push("Erfahrungsniveau der Stelle");

  /*
   * Die Empfehlung.
   *
   * Die Reihenfolge ist die Rangfolge, und sie beginnt beim
   * Ausschluss: ein harter Konflikt macht alles andere gegenstandslos.
   * Ihn gegen eine gute Passung abzuwägen hiesse, die Bedingung der
   * Person zu überstimmen.
   */
  const recommendation: Recommendation =
    preflight.conflicts.length > 0 || reqSummary.blocking.length > 0
      ? "deprioritise"
      : scored.constraints.overall === "blocked"
        ? "deprioritise"
        : preflight.unclear.length >= 4
          ? "clarify_first"
          : scored.fit.coverage < 0.35
            ? "build_evidence"
            : effort.level === "hoch"
              ? "prepare_documents"
              : scored.fit.band === "high"
                ? "apply_now"
                : "watch";

  const headline =
    recommendation === "deprioritise"
      ? catches[0] ?? "Etwas spricht dagegen."
      : recommendation === "clarify_first"
        ? `${unknowns.length} wichtige Punkte stehen nicht in der Anzeige.`
        : recommendation === "build_evidence"
          ? "Für die Anforderungen fehlen in deinem Profil noch Belege."
          : reasons[0] ?? "Sieh sie dir an.";

  return {
    reasons: reasons.slice(0, 3),
    catches: catches.slice(0, 3),
    unknowns: unknowns.slice(0, 5),
    effort,
    requirements: { classified, blocking: reqSummary.blocking, summary: reqSummary.summary },
    seniority,
    preflight,
    recommendation,
    headline,
  };
}

export function recommendationLabel(r: Recommendation): string {
  return EMPFEHLUNG_TEXT[r];
}
