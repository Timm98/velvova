import type {
  AiTransitionResult,
  ConfidenceResult,
  ConstraintResult,
  FitResult,
  JobQualityResult,
  ListingConfidenceResult,
} from "@paycheck/domain";
import type { Translator } from "@paycheck/i18n";

/**
 * Darstellung der Bewertungen.
 *
 * Hier wird eine Produktentscheidung sichtbar: Fit und Confidence stehen
 * immer nebeneinander, nie ineinander. Und wo die Datenlage nicht reicht,
 * erscheint keine Zahl - sondern der Grund.
 *
 * Farbe traegt nirgends allein die Information: jeder farbige Zustand hat
 * zusätzlich Text.
 */

const box = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "var(--space-1)",
};

const label: React.CSSProperties = {
  fontSize: "var(--text-xs)",
  color: "var(--text-muted)",
  letterSpacing: "0.02em",
  textTransform: "uppercase",
};

export function FitDisplay({ fit, t, compact = false }: { fit: FitResult; t: Translator["t"]; compact?: boolean }) {
  const bandText: Record<FitResult["band"], string> = {
    high: t("jobs.fitHigh"),
    medium: t("jobs.fitMedium"),
    exploratory: t("jobs.fitExploratory"),
    insufficient_data: t("jobs.fitInsufficient"),
  };

  const tone =
    fit.band === "high" ? "var(--positive)" : fit.band === "medium" ? "var(--accent-text)" : "var(--text-secondary)";

  return (
    <div style={box}>
      <span style={label}>{t("jobs.fit")}</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
        {fit.score !== null ? (
          <>
            <strong style={{ fontSize: compact ? "var(--text-lg)" : "var(--text-2xl)", color: tone, lineHeight: 1 }}>
              {fit.score}
            </strong>
            <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>/ 100</span>
          </>
        ) : (
          <strong style={{ fontSize: "var(--text-sm)", color: tone, fontWeight: 500 }}>{bandText[fit.band]}</strong>
        )}
      </span>
      {fit.score !== null && (
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>{bandText[fit.band]}</span>
      )}
    </div>
  );
}

export function ConfidenceDisplay({
  confidence,
  t,
}: {
  confidence: ConfidenceResult;
  t: Translator["t"];
}) {
  const levelText = {
    high: t("jobs.confidenceHigh"),
    medium: t("jobs.confidenceMedium"),
    low: t("jobs.confidenceLow"),
  }[confidence.level];

  const tone =
    confidence.level === "high"
      ? "var(--positive)"
      : confidence.level === "medium"
        ? "var(--caution)"
        : "var(--critical)";

  return (
    <div style={box}>
      <span style={label}>{t("jobs.confidence")}</span>
      <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        {/* Drei Balken statt einer Zahl: Sicherheit ist keine Präzision. */}
        <span aria-hidden style={{ display: "flex", gap: "2px" }}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 10,
                height: 4,
                borderRadius: 2,
                background:
                  i < (confidence.level === "high" ? 3 : confidence.level === "medium" ? 2 : 1)
                    ? tone
                    : "var(--border-default)",
              }}
            />
          ))}
        </span>
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{levelText}</span>
      </span>
    </div>
  );
}

export function JobQualityDisplay({ quality, t }: { quality: JobQualityResult; t: Translator["t"] }) {
  return (
    <div style={box}>
      <span style={label}>{t("jobs.jobQuality")}</span>
      {quality.insufficientData ? (
        <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
          nicht ausreichend beurteilbar
        </span>
      ) : (
        <span style={{ display: "flex", alignItems: "baseline", gap: "var(--space-1)" }}>
          <strong style={{ fontSize: "var(--text-lg)", lineHeight: 1 }}>{quality.score}</strong>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>/ 100</span>
        </span>
      )}
    </div>
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
    <div style={box}>
      <span style={label}>{t("jobs.aiTransition")}</span>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{AI_LABEL[ai.category]}</span>
    </div>
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
    <div style={box}>
      <span style={label}>{t("jobs.listingConfidence")}</span>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
        {listing.score} / 100
        {listing.possiblyStale && (
          <span style={{ color: "var(--caution)", marginLeft: "var(--space-2)" }}>· evtl. veraltet</span>
        )}
      </span>
    </div>
  );
}

/** Hinweis bei ausgeschlossenen Stellen. Immer mit konkretem Grund. */
export function BlockedNotice({ constraints, t }: { constraints: ConstraintResult; t: Translator["t"] }) {
  if (constraints.overall !== "blocked") return null;
  const reasons = constraints.checks.filter((c) => c.verdict === "blocked");

  return (
    <div
      role="note"
      style={{
        background: "var(--critical-subtle)",
        border: "1px solid var(--critical)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-3) var(--space-4)",
        fontSize: "var(--text-sm)",
      }}
    >
      <strong style={{ color: "var(--critical)" }}>{t("jobs.blockedBecause")}:</strong>
      <ul style={{ listStyle: "none", marginTop: "var(--space-2)", display: "grid", gap: "var(--space-1)" }}>
        {reasons.map((r) => (
          <li key={r.key}>
            <strong>{r.label}:</strong> {r.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Faktorenaufschlüsselung. Unbekannte Faktoren werden ausdrücklich als
 * unbekannt gezeigt, nicht weggelassen - sonst entsteht der Eindruck, sie
 * seien geprüft und schlecht ausgefallen.
 */
export function FactorBreakdown({
  factors,
  title,
}: {
  factors: { key: string; label: string; raw: number | null; weight: number; explanation: string }[];
  title: string;
}) {
  const known = factors.filter((f) => f.raw !== null);
  const unknown = factors.filter((f) => f.raw === null);

  return (
    <section style={{ display: "grid", gap: "var(--space-4)" }}>
      <h3 style={{ fontSize: "var(--text-lg)" }}>{title}</h3>

      <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-4)" }}>
        {known.map((f) => (
          <li key={f.key} style={{ display: "grid", gap: "var(--space-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-3)" }}>
              <span style={{ fontWeight: 500 }}>{f.label}</span>
              <span style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", whiteSpace: "nowrap" }}>
                Gewicht {Math.round(f.weight * 100)} %
              </span>
            </div>
            <div
              aria-hidden
              style={{
                height: 6,
                background: "var(--surface-inset)",
                borderRadius: "var(--radius-full)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.round((f.raw ?? 0) * 100)}%`,
                  height: "100%",
                  background: "var(--accent)",
                  borderRadius: "var(--radius-full)",
                }}
              />
            </div>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{f.explanation}</p>
          </li>
        ))}
      </ul>

      {unknown.length > 0 && (
        <div
          style={{
            background: "var(--surface-sunken)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-4)",
            display: "grid",
            gap: "var(--space-3)",
          }}
        >
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
            Zu diesen Punkten liegen keine Angaben vor. Sie werden <strong>nicht</strong> als schlecht gewertet -
            ihr Gewicht verteilt sich auf das Bekannte. Sie senken nur die Sicherheit.
          </p>
          <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)" }}>
            {unknown.map((f) => (
              <li key={f.key} style={{ fontSize: "var(--text-sm)" }}>
                <strong style={{ color: "var(--text-secondary)" }}>{f.label}</strong>
                <br />
                <span style={{ color: "var(--text-muted)" }}>{f.explanation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
