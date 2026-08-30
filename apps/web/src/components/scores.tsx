import type {
  AiTransitionResult,
  ConfidenceResult,
  ConstraintResult,
  FitResult,
  JobQualityResult,
  ListingConfidenceResult,
} from "@paycheck/domain";
import type { Translator } from "@paycheck/i18n";
import { ConfidenceMeter, MetricValue, ScoreRing, FactorList } from "./ui/score.tsx";

/**
 * Die fachliche Schicht über den Anzeige-Bausteinen.
 *
 * Hier wird die wichtigste Produktentscheidung sichtbar: Passung und
 * Sicherheit stehen NEBENEINANDER, nie ineinander. Eine 82 bei dünner
 * Datenlage ist eine andere Aussage als dieselbe Zahl bei guter.
 *
 * Farbe trägt nirgends allein die Information: jeder farbige Zustand hat
 * zusätzlich Text.
 */

export function FitDisplay({
  fit,
  t,
  compact = false,
}: {
  fit: FitResult;
  t: Translator["t"];
  compact?: boolean;
}) {
  const bandText: Record<FitResult["band"], string> = {
    high: t("jobs.fitHigh"),
    medium: t("jobs.fitMedium"),
    exploratory: t("jobs.fitExploratory"),
    insufficient_data: t("jobs.fitInsufficient"),
  };

  return (
    <ScoreRing
      value={fit.score}
      label={t("jobs.fit")}
      band={bandText[fit.band]}
      size={compact ? "sm" : "md"}
    />
  );
}

export function ConfidenceDisplay({
  confidence,
  t,
}: {
  confidence: ConfidenceResult;
  t: Translator["t"];
}) {
  return <ConfidenceMeter level={confidence.level} label={t("jobs.confidence")} />;
}

export function JobQualityDisplay({
  quality,
  t,
}: {
  quality: JobQualityResult;
  t: Translator["t"];
}) {
  return (
    <MetricValue
      label={t("jobs.jobQuality")}
      value={quality.insufficientData ? "nicht ausreichend beurteilbar" : `${quality.score} / 100`}
      tone={quality.insufficientData ? "muted" : "default"}
    />
  );
}

const AI_LABEL: Record<AiTransitionResult["category"], string> = {
  strongly_augmentable: "stark augmentierbar",
  partly_transformable: "teilweise transformierbar",
  relatively_robust: "relativ robust",
  unclear_data: "Datenbasis unklar",
};

export function AiTransitionDisplay({ ai, t }: { ai: AiTransitionResult; t: Translator["t"] }) {
  return (
    <MetricValue
      label={t("jobs.aiTransition")}
      value={AI_LABEL[ai.category]}
      tone={ai.category === "unclear_data" ? "muted" : "default"}
    />
  );
}

export function ListingConfidenceDisplay({
  listing,
  t,
}: {
  listing: ListingConfidenceResult;
  t: Translator["t"];
}) {
  return (
    <MetricValue
      label={t("jobs.listingConfidence")}
      value={`${listing.score} / 100`}
      hint={listing.possiblyStale ? "möglicherweise veraltet" : undefined}
      tone={listing.possiblyStale ? "caution" : "default"}
    />
  );
}

/** Hinweis bei ausgeschlossenen Stellen. Immer mit konkretem Grund. */
export function BlockedNotice({
  constraints,
  t,
}: {
  constraints: ConstraintResult;
  t: Translator["t"];
}) {
  if (constraints.overall !== "blocked") return null;
  const reasons = constraints.checks.filter((c) => c.verdict === "blocked");

  return (
    <div
      role="note"
      className="grid gap-2 rounded-(--radius-md) border border-critical/30 bg-critical-soft px-4 py-3"
    >
      <p className="text-sm font-medium text-critical">{t("jobs.blockedBecause")}</p>
      <ul className="grid gap-1.5">
        {reasons.map((r) => (
          <li key={r.key} className="text-sm leading-relaxed">
            <span className="font-medium">{r.label}: </span>
            <span className="text-ink-2">{r.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Faktorenaufschlüsselung.
 *
 * Unbekannte Faktoren werden ausdrücklich als unbekannt gezeigt, nicht
 * weggelassen — sonst entsteht der Eindruck, sie seien geprüft und
 * schlecht ausgefallen.
 */
export function FactorBreakdown({
  factors,
  title,
}: {
  factors: {
    key: string;
    label: string;
    raw: number | null;
    weight: number;
    explanation: string;
  }[];
  title: string;
}) {
  return (
    <FactorList
      factors={factors}
      title={title}
      emptyNote="Zu diesen Punkten liegen keine Angaben vor. Sie werden nicht als schlecht gewertet — ihr Gewicht verteilt sich auf das Bekannte. Sie senken nur die Sicherheit."
    />
  );
}
