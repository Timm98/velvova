import type { Job, JobQualityResult, ReviewAggregate, ReviewTheme } from "@paycheck/domain";
import { SCORING_VERSION } from "@paycheck/domain";
import { toScore100, weightedScore, type WeightedInput } from "./weighted.ts";

/**
 * Job Quality steht getrennt vom Fit. Eine Stelle kann fachlich perfekt
 * passen und trotzdem ein schlechter Arbeitsplatz sein. Beides in eine
 * Zahl zu ruehren würde genau die Information zerstoeren, die zählt.
 *
 * Die Dimensionen folgen der mehrdimensionalen Sicht auf Jobqualität
 * (Einkommen, Sicherheit, Arbeitsumfeld), wie sie die OECD verwendet.
 * Siehe docs/RESEARCH_RATIONALE.md.
 */

export interface JobQualityInput {
  job: Job;
  reviews: ReviewAggregate[];
  themes: ReviewTheme[];
  /** Regionaler Referenzwert für das Gehalt, falls bekannt. */
  salaryBenchmarkPerYear?: number | null;
}

function themeScore(themes: ReviewTheme[], keywords: string[]): number | null {
  const relevant = themes.filter((t) =>
    keywords.some((k) => t.theme.toLowerCase().includes(k) || t.summary.toLowerCase().includes(k)),
  );
  if (relevant.length === 0) return null;
  const total = relevant.reduce((s, t) => s + t.mentionCount, 0);
  if (total === 0) return null;
  const positive = relevant.filter((t) => t.sentiment === "positive").reduce((s, t) => s + t.mentionCount, 0);
  const mixed = relevant.filter((t) => t.sentiment === "mixed").reduce((s, t) => s + t.mentionCount, 0);
  return (positive + mixed * 0.5) / total;
}

export function computeJobQuality(input: JobQualityInput): JobQualityResult {
  const { job, reviews, themes } = input;

  // --- Einkommensqualität ---
  let income: number | null = null;
  if (job.salary.disclosed && (job.salary.min ?? job.salary.max) !== null) {
    const mid = job.salary.max && job.salary.min
      ? (job.salary.min + job.salary.max) / 2
      : (job.salary.max ?? job.salary.min ?? 0);
    const yearly = job.salary.period === "month" ? mid * 12 : job.salary.period === "hour" ? mid * 40 * 52 : mid;
    const bench = input.salaryBenchmarkPerYear ?? null;
    if (bench && bench > 0) {
      income = Math.min(1, Math.max(0, 0.5 + (yearly - bench) / (bench * 0.8)));
    } else {
      // Ohne Referenz zählt nur, dass überhaupt transparent gemacht wird.
      income = 0.6;
    }
  }

  // --- Beschäftigungssicherheit ---
  let security: number | null = null;
  if (job.contractType !== null) {
    const map: Record<string, number> = {
      permanent: 1, apprenticeship: 0.8, fixed_term: 0.5, working_student: 0.4,
      internship: 0.3, freelance: 0.35, temp_agency: 0.3,
    };
    security = map[job.contractType] ?? null;
  }

  // --- Arbeitsbelastung und Umfeld ---
  const workload = themeScore(themes, ["belastung", "workload", "überstunden", "overtime", "stress", "druck"]);

  // --- Arbeitszeit und Flexibilität ---
  let flexibility: number | null = null;
  const flexSignals: number[] = [];
  if (job.remotePercent !== null) flexSignals.push(Math.min(1, job.remotePercent / 100));
  if (job.shiftWork !== null) flexSignals.push(job.shiftWork ? 0.3 : 0.8);
  const flexTheme = themeScore(themes, ["flexib", "work-life", "gleitzeit", "homeoffice"]);
  if (flexTheme !== null) flexSignals.push(flexTheme);
  if (flexSignals.length > 0) flexibility = flexSignals.reduce((a, b) => a + b, 0) / flexSignals.length;

  // --- Führung und Kultur ---
  const culture = themeScore(themes, ["fuehrung", "leadership", "vorgesetzt", "manager", "kultur", "team", "kollegen"]);

  // --- Entwicklung und Lernen ---
  const development = themeScore(themes, ["entwicklung", "lernen", "weiterbildung", "training", "karriere", "growth"]);

  const inputs: WeightedInput[] = [
    { key: "income", label: "Einkommensqualität und Fairness", raw: income, weight: 0.20,
      explanation: income === null ? "Die Anzeige nennt kein Gehalt - das ist keine schlechte, sondern gar keine Angabe."
        : job.salary.disclosed ? "Gehalt ist offengelegt und eingeordnet." : "" },
    { key: "security", label: "Beschäftigungssicherheit", raw: security, weight: 0.15,
      explanation: security === null ? "Die Vertragsart ist nicht angegeben."
        : `Vertragsart: ${job.contractType}.` },
    { key: "workload", label: "Arbeitsbelastung und Arbeitsumfeld", raw: workload, weight: 0.20,
      explanation: workload === null ? "Keine belastbaren Aussagen zur Arbeitsbelastung vorhanden."
        : "Aus Mitarbeiterstimmen zu Belastung und Arbeitsumfeld." },
    { key: "flexibility", label: "Arbeitszeit und Flexibilität", raw: flexibility, weight: 0.15,
      explanation: flexibility === null ? "Keine Angaben zu Arbeitszeit oder Flexibilität."
        : "Aus Remote-Anteil, Schichtmodell und Aussagen zur Flexibilität." },
    { key: "culture", label: "Führung, Kultur und soziale Bedingungen", raw: culture, weight: 0.15,
      explanation: culture === null ? "Keine belastbaren Aussagen zu Führung und Kultur."
        : "Aus Mitarbeiterstimmen zu Führung und Zusammenarbeit." },
    { key: "development", label: "Entwicklung und Lernmoeglichkeiten", raw: development, weight: 0.15,
      explanation: development === null ? "Keine belastbaren Aussagen zu Entwicklungsmoeglichkeiten."
        : "Aus Mitarbeiterstimmen zu Lernen und Weiterentwicklung." },
  ];

  const { value, coverage, factors } = weightedScore(inputs);

  // Unter dieser Abdeckung ist eine Gesamtzahl irrefuehrend. Dann sagen wir
  // "nicht ausreichend beurteilbar" statt einen schlechten Wert zu zeigen.
  const MIN_COVERAGE = 0.5;
  const insufficient = value === null || coverage < MIN_COVERAGE;

  void reviews;
  return {
    score: insufficient ? null : toScore100(value),
    insufficientData: insufficient,
    dimensions: factors,
    version: SCORING_VERSION,
  };
}
