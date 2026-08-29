import type { ConfidenceResult, Job, ReviewAggregate } from "@paycheck/domain";
import { SCORING_VERSION } from "@paycheck/domain";
import { toScore100, weightedScore, type WeightedInput } from "./weighted.js";

/**
 * Confidence steht bewusst neben dem Fit, nicht darin.
 *
 * Der Fit sagt "wie gut passt das". Die Confidence sagt "wie sicher koennen
 * wir uns dabei ueberhaupt sein". Ein Fit von 82 bei niedriger Confidence
 * ist eine andere Aussage als derselbe Fit bei hoher - und der Mensch muss
 * beides sehen, statt sich auf eine Zahl zu verlassen, die Unsicherheit
 * verschluckt.
 */

export interface ConfidenceInput {
  job: Job;
  /** Abdeckung des Fit aus computeFit. 0..1 */
  fitCoverage: number;
  /** Anteil abgedeckter Interviewthemen. 0..1 */
  profileCoverage: number;
  requirementCount: number;
  reviews: ReviewAggregate[];
  now?: Date;
}

const DAY = 86_400_000;

export function computeConfidence(input: ConfidenceInput): ConfidenceResult {
  const now = input.now ?? new Date();
  const reducedBy: string[] = [];

  // --- Profilabdeckung ---
  const profile = Math.min(1, input.profileCoverage * 0.7 + input.fitCoverage * 0.3);
  if (profile < 0.6) reducedBy.push("Dein Profil ist noch nicht vollstaendig genug.");

  // --- Vollstaendigkeit der Anzeige ---
  const fields: Array<[string, boolean]> = [
    ["Gehalt", input.job.salary.disclosed],
    ["Aufgaben", input.job.coreTasks.length > 0],
    ["Anforderungen", input.requirementCount > 0],
    ["Vertragsart", input.job.contractType !== null],
    ["Arbeitszeit", input.job.weeklyHours !== null],
    ["Erfahrungsniveau", input.job.experienceLevel !== null],
    ["Arbeitsmodell", input.job.remotePercent !== null],
  ];
  const present = fields.filter(([, ok]) => ok);
  const listing = present.length / fields.length;
  const missing = fields.filter(([, ok]) => !ok).map(([n]) => n);
  if (missing.length > 0) reducedBy.push(`Die Anzeige macht keine Angabe zu: ${missing.join(", ")}.`);

  // --- Quellenqualitaet und Aktualitaet ---
  let sourceQuality: number | null = null;
  if (input.job.publishedAt) {
    const ageDays = (now.getTime() - input.job.publishedAt.getTime()) / DAY;
    const freshness = ageDays <= 7 ? 1 : ageDays <= 30 ? 0.8 : ageDays <= 60 ? 0.5 : 0.25;
    const linkOk = input.job.lastLinkCheckOk === true ? 1 : input.job.lastLinkCheckOk === false ? 0 : 0.5;
    const hasOriginal = input.job.originalUrl ? 1 : 0.4;
    sourceQuality = freshness * 0.5 + linkOk * 0.25 + hasOriginal * 0.25;
    if (ageDays > 60) reducedBy.push(`Die Anzeige ist ${Math.round(ageDays)} Tage alt.`);
  } else {
    reducedBy.push("Es ist kein Veroeffentlichungsdatum bekannt.");
  }

  // --- Abdeckung externer Unternehmensinformationen ---
  let external: number | null = null;
  if (input.reviews.length > 0) {
    const employee = input.reviews.filter((r) => r.sourceKind === "employee_reviews");
    const sample = employee.reduce((s, r) => s + (r.sampleSize ?? 0), 0);
    const kinds = new Set(input.reviews.map((r) => r.sourceKind)).size;
    const sampleScore = sample >= 50 ? 1 : sample >= 15 ? 0.6 : sample > 0 ? 0.3 : 0.1;
    external = Math.min(1, sampleScore * 0.7 + Math.min(kinds / 3, 1) * 0.3);
    if (sample < 15) reducedBy.push("Zu diesem Unternehmen liegen nur wenige Mitarbeiterstimmen vor.");
  } else {
    reducedBy.push("Es liegen keine externen Informationen zum Unternehmen vor.");
  }

  const inputs: WeightedInput[] = [
    { key: "profile_coverage", label: "Profilabdeckung", raw: profile, weight: 0.35,
      explanation: `Dein Profil deckt ${Math.round(input.profileCoverage * 100)} % der Themen ab.` },
    { key: "listing_completeness", label: "Vollstaendigkeit der Anzeige", raw: listing, weight: 0.30,
      explanation: `${present.length} von ${fields.length} wichtigen Angaben sind vorhanden.` },
    { key: "source_quality", label: "Quellenqualitaet und Aktualitaet", raw: sourceQuality, weight: 0.20,
      explanation: sourceQuality === null ? "Kein Veroeffentlichungsdatum bekannt."
        : "Alter der Anzeige, letzter Linkcheck und Verfuegbarkeit der Originalquelle." },
    { key: "external_coverage", label: "Externe Unternehmensinformationen", raw: external, weight: 0.15,
      explanation: external === null ? "Keine externen Quellen vorhanden."
        : `${input.reviews.length} Quellen, nach Art getrennt ausgewiesen.` },
  ];

  const { value, factors } = weightedScore(inputs);
  const score = value === null ? 0 : toScore100(value);
  const level = score >= 70 ? "high" : score >= 45 ? "medium" : "low";

  return { score, level, factors, reducedBy, version: SCORING_VERSION };
}
