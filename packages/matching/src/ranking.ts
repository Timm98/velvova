import type {
  AiTransitionResult, ConfidenceResult, ConstraintResult, FitResult,
  JobQualityResult, ListingConfidenceResult, OverallRanking,
} from "@paycheck/domain";
import { SCORING_VERSION } from "@paycheck/domain";
import { fitGesamt } from "./fitgesamt.ts";
import { toScore100, weightedScore, type WeightedInput } from "./weighted.ts";

/**
 * Gesamtranking. Harte Bedingungen bleiben vorgelagert: eine blockierte
 * Stelle bekommt gar keinen Gesamtwert, weil "72 von 100, aber du darfst
 * dort nicht arbeiten" eine sinnlose Zahl ist.
 *
 * Wenn zu viele Bestandteile unbekannt sind, wird ebenfalls kein
 * Gesamtwert gebildet. Lieber keine Zahl als eine, die Sicherheit
 * vortäuscht.
 */

export interface RankingWeights {
  fit: number;
  jobQuality: number;
  aiOutlook: number;
  listingConfidence: number;
}

export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  fit: 0.60,
  jobQuality: 0.20,
  aiOutlook: 0.10,
  listingConfidence: 0.10,
};

const AI_OUTLOOK_VALUE: Record<AiTransitionResult["category"], number | null> = {
  strongly_augmentable: 0.85,
  relatively_robust: 0.8,
  partly_transformable: 0.55,
  unclear_data: null,
};

export interface RankingInput {
  constraints: ConstraintResult;
  fit: FitResult;
  confidence: ConfidenceResult;
  jobQuality: JobQualityResult;
  aiTransition: AiTransitionResult;
  listingConfidence: ListingConfidenceResult;
  weights?: Partial<RankingWeights>;
}

export function computeOverall(input: RankingInput): OverallRanking {
  if (input.constraints.overall === "blocked") {
    return {
      score: null,
      components: [],
      suppressedReason:
        `Diese Stelle widerspricht einer deiner harten Bedingungen (${input.constraints.blockedBy.join(", ")}). ` +
        `Ein Gesamtwert wäre hier irrefuehrend.`,
      version: SCORING_VERSION,
    };
  }

  const w = { ...DEFAULT_RANKING_WEIGHTS, ...input.weights };
  const inputs: WeightedInput[] = [
    { key: "fit", label: "Fachliche Passung", weight: w.fit,
      raw: input.fit.score !== null ? input.fit.score / 100 : null,
      explanation: input.fit.score !== null ? input.fit.topReason
        : "Die Datenbasis reicht noch nicht für einen Passungswert." },
    { key: "job_quality", label: "Jobqualität", weight: w.jobQuality,
      raw: input.jobQuality.score !== null ? input.jobQuality.score / 100 : null,
      explanation: input.jobQuality.insufficientData
        ? "Zur Jobqualität liegen zu wenige belastbare Angaben vor."
        : "Aus Einkommen, Sicherheit, Belastung, Flexibilität, Kultur und Entwicklung." },
    { key: "ai_outlook", label: "Entwicklung durch KI", weight: w.aiOutlook,
      raw: AI_OUTLOOK_VALUE[input.aiTransition.category],
      explanation: input.aiTransition.category === "unclear_data"
        ? "Die Anzeige beschreibt zu wenig, um die Aufgabenentwicklung einzuschaetzen."
        : `Eingeordnet als: ${input.aiTransition.category}.` },
    { key: "listing_confidence", label: "Vertrauen in die Anzeige", weight: w.listingConfidence,
      raw: input.listingConfidence.score / 100,
      explanation: `Quelle, Alter und Vollständigkeit ergeben ${input.listingConfidence.score} von 100.` },
  ];

  const { value, coverage, factors } = weightedScore(inputs);

  // Unter der Hälfte der Gewichte bekannt: kein Gesamtwert.
  if (value === null || coverage < 0.5) {
    return {
      score: null,
      components: factors,
      suppressedReason:
        "Zu viele Bestandteile sind unbekannt. Ein Gesamtwert würde eine Sicherheit vortaeuschen, die nicht besteht.",
      version: SCORING_VERSION,
    };
  }

  return { score: toScore100(value), components: factors, suppressedReason: null, version: SCORING_VERSION };
}

export type SortKey =
  | "best_overall" | "highest_fit" | "best_job_quality" | "highest_salary"
  | "future_robust" | "shortest_commute" | "newest";

export interface RankableJob {
  jobId: string;
  overall: OverallRanking;
  fit: FitResult;
  /**
   * Wie belastbar die Einschätzung ist.
   *
   * Geht mit 20 Prozent in den Fit Score ein — deshalb steht sie hier
   * und nicht nur in der Oberfläche: Sortierung und Anzeige müssen
   * dieselbe Zahl benutzen, sonst steht oben eine Stelle mit einer
   * kleineren Zahl als die darunter.
   */
  confidence: ConfidenceResult;
  jobQuality: JobQualityResult;
  /**
   * Die Anzeigenqualität — dieselbe Zahl, die in der Liste steht.
   *
   * ══════════════════════════════════════════════════════════════
   * Warum nicht `jobQuality`, obwohl das danebensteht
   * ══════════════════════════════════════════════════════════════
   *
   * Weil es zwei verschiedene Zahlen sind. `jobQuality` bewertet den
   * Arbeitgeber, `anzeige` die Vollständigkeit der Anzeige — und in
   * der Zeile wird `anzeige` gezeigt.
   *
   * Sortiert wurde bis eben nach `jobQuality`. Damit stand die Liste
   * in einer anderen Reihenfolge als die Zahlen, die sie anzeigte:
   * oben eine 71, darunter eine 78. Genau der Fehler, den der
   * Kommentar über `confidence` beschreibt — nur eine Zeile weiter
   * unten und deshalb übersehen.
   */
  anzeige: { score: number | null };
  aiTransition: AiTransitionResult;
  constraints: ConstraintResult;
  salaryPerYear: number | null;
  commuteMinutes: number | null;
  publishedAt: Date | null;
}

/** null-Werte landen konsequent hinten, statt als 0 zu gewinnen. */
function cmpNullable(a: number | null, b: number | null, desc = true): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return desc ? b - a : a - b;
}

export function sortJobs(jobs: RankableJob[], key: SortKey): RankableJob[] {
  const out = [...jobs];
  const rank: Record<AiTransitionResult["category"], number> = {
    relatively_robust: 3, strongly_augmentable: 2, partly_transformable: 1, unclear_data: 0,
  };
  switch (key) {
    case "highest_fit": out.sort((a, b) => cmpNullable(a.fit.score, b.fit.score)); break;
    case "best_job_quality": out.sort((a, b) => cmpNullable(a.jobQuality.score, b.jobQuality.score)); break;
    case "highest_salary": out.sort((a, b) => cmpNullable(a.salaryPerYear, b.salaryPerYear)); break;
    case "future_robust":
      out.sort((a, b) => rank[b.aiTransition.category] - rank[a.aiTransition.category]); break;
    case "shortest_commute": out.sort((a, b) => cmpNullable(a.commuteMinutes, b.commuteMinutes, false)); break;
    case "newest":
      out.sort((a, b) => cmpNullable(a.publishedAt?.getTime() ?? null, b.publishedAt?.getTime() ?? null)); break;
    case "best_overall":
    default:
      /*
       * Sortiert wird nach der Zahl, die auch angezeigt wird.
       *
       * Vorher ordnete `overall.score` — eine andere Formel als die,
       * die in der Liste als Fit Score steht. Beide konnten
       * auseinanderlaufen, und dann stand oben eine Stelle mit einer
       * kleineren Zahl als die darunter. Das ist der Fehler, den
       * niemand meldet und dem jeder misstraut.
       *
       * `fitGesamt` rechnet aus dem, was vorhanden ist: Fehlt die
       * Passung, entscheiden Anzeigenqualität und Sicherheit. Die
       * frühere Fallkette — Gesamtwert, sonst Jobqualität, sonst
       * Vertrauen — ist damit im selben Ausdruck enthalten, statt als
       * Reihe von Ausweichschritten.
       */
      out.sort((a, b) =>
        cmpNullable(
          fitGesamt(a.fit.score, a.anzeige.score, a.confidence.score),
          fitGesamt(b.fit.score, b.anzeige.score, b.confidence.score),
        ),
      );
      break;
  }
  // Blockierte Stellen erscheinen nie oben, egal nach welchem Kriterium.
  return out.sort((a, b) => Number(a.constraints.overall === "blocked") - Number(b.constraints.overall === "blocked"));
}
