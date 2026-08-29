import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { getDb, schema, withUser } from "@paycheck/db";
import { eq } from "drizzle-orm";
import { listJobsForUser, loadProfileContext } from "@/lib/matching";
import { loadGate } from "@/lib/gate";
import type { SortKey } from "@paycheck/matching";
import { Badge, buttonStyle, Card, DemoBadge, EmptyState, PageHeader, Stack } from "@/components/ui";
import {
  AiTransitionDisplay,
  ConfidenceDisplay,
  FitDisplay,
  JobQualityDisplay,
  ListingConfidenceDisplay,
} from "@/components/scores";
import { SaveJobButton } from "./SaveJobButton";

export const metadata: Metadata = { title: "Jobs" };
export const dynamic = "force-dynamic";

const SORT_KEYS: SortKey[] = [
  "best_overall", "highest_fit", "best_job_quality", "highest_salary",
  "future_robust", "shortest_commute", "newest",
];

/**
 * Die Jobliste.
 *
 * Standardmaessig eine begruendete Auswahl, nicht "alle Jobs". Jede Karte
 * zeigt genau so viel, wie fuer eine Entscheidung noetig ist: Passung und
 * Sicherheit getrennt, ein Grund, ein Vorbehalt.
 *
 * Ausgeschlossene Stellen erscheinen nicht in der Auswahl - aber sie sind
 * auf Wunsch sichtbar, mit konkretem Grund. Etwas stillschweigend
 * wegzufiltern waere schlechter als es zu begruenden.
 */
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; blocked?: string }>;
}) {
  const user = await requireUser();
  const { t, isDemoMode } = await getPageContext();
  const params = await searchParams;

  const sort = (SORT_KEYS as string[]).includes(params.sort ?? "")
    ? (params.sort as SortKey)
    : "best_overall";
  const includeBlocked = params.blocked === "1";

  const db = await getDb();
  const ctx = await loadProfileContext(user.id);

  const gate = await loadGate(user.id);

  // Der Riegel: ohne bestaetigtes Mindestprofil keine personalisierten
  // Vorschlaege. Das ist kein Gimmick, sondern der Unterschied zwischen
  // Empfehlung und Zufall.
  if (!gate.unlocked) {
    return (
      <Stack gap={6}>
        <PageHeader title={t("jobs.title")} />
        <EmptyState
          title={t("jobs.locked")}
          body={`${t("jobs.lockedBody")} ${gate.reason}`}
          action={
            <Link href={gate.profileConfirmed ? "/app/nina" : "/app/profile"} style={buttonStyle("primary")}>
              {gate.profileConfirmed ? t("jobs.lockedCta") : "Profil bestaetigen"}
            </Link>
          }
        />
      </Stack>
    );
  }

  const saved = await withUser(db, user.id, (tx) =>
    tx.select({ jobId: schema.savedJobs.jobId }).from(schema.savedJobs).where(eq(schema.savedJobs.userId, user.id)),
  );
  const savedIds = new Set(saved.map((s) => s.jobId));

  const { jobs, blockedCount } = await listJobsForUser(user.id, ctx, { sort, includeBlocked });

  return (
    <Stack gap={6}>
      <PageHeader title={t("jobs.title")} />

      {isDemoMode && <DemoBadge />}

      {/* Sortierung */}
      <nav aria-label={t("jobs.sortBy")} className="scroll-x">
        <ul style={{ listStyle: "none", display: "flex", gap: "var(--space-2)", paddingBottom: 4 }}>
          {SORT_KEYS.map((key) => {
            const active = key === sort;
            const label = {
              best_overall: t("jobs.sortBestOverall"),
              highest_fit: t("jobs.sortHighestFit"),
              best_job_quality: t("jobs.sortBestQuality"),
              highest_salary: t("jobs.sortHighestSalary"),
              future_robust: t("jobs.sortFutureRobust"),
              shortest_commute: t("jobs.sortShortestCommute"),
              newest: t("jobs.sortNewest"),
            }[key];
            return (
              <li key={key}>
                <Link
                  href={`/app/jobs?sort=${key}${includeBlocked ? "&blocked=1" : ""}`}
                  aria-current={active ? "true" : undefined}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    minHeight: 40,
                    padding: "var(--space-2) var(--space-4)",
                    borderRadius: "var(--radius-full)",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border-default)"}`,
                    background: active ? "var(--accent-subtle)" : "var(--surface-raised)",
                    color: active ? "var(--accent-text)" : "var(--text-secondary)",
                    fontSize: "var(--text-sm)",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {blockedCount > 0 && (
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
          {includeBlocked
            ? `${blockedCount} Stellen widersprechen einer deiner harten Bedingungen. Sie sind unten mit Begruendung sichtbar.`
            : `${blockedCount} Stellen sind ausgeschlossen, weil sie einer deiner harten Bedingungen widersprechen.`}{" "}
          <Link
            href={`/app/jobs?sort=${sort}${includeBlocked ? "" : "&blocked=1"}`}
            style={{ color: "var(--accent-text)" }}
          >
            {includeBlocked ? "Ausblenden" : t("jobs.showBlocked")}
          </Link>
        </p>
      )}

      {jobs.length === 0 ? (
        <EmptyState title={t("states.emptyTitle")} body={t("jobs.empty")} />
      ) : (
        <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-4)" }}>
          {jobs.map((j) => {
            const blocked = j.constraints.overall === "blocked";
            return (
              <Card
                as="li"
                key={j.jobId}
                style={{
                  opacity: blocked ? 0.7 : 1,
                  borderColor: blocked ? "var(--critical)" : "var(--border-subtle)",
                }}
              >
                <Stack gap={4}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-4)", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <Link href={`/app/jobs/${j.jobId}`} style={{ textDecoration: "none" }}>
                        <h2 style={{ fontSize: "var(--text-lg)" }}>{j.job.title}</h2>
                      </Link>
                      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: 2 }}>
                        {j.job.companyName} · {j.job.location} ·{" "}
                        {j.job.workModel === "remote" ? "remote" : j.job.workModel === "hybrid" ? "hybrid" : "vor Ort"}
                        {j.commuteMinutes !== null && j.commuteMinutes > 0 && ` · ca. ${j.commuteMinutes} Min Weg`}
                      </p>
                      <p style={{ fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>
                        {j.job.salary.disclosed && j.salaryPerYear ? (
                          <strong>
                            {new Intl.NumberFormat("de-DE", {
                              style: "currency",
                              currency: j.job.salary.currency,
                              maximumFractionDigits: 0,
                            }).format(j.job.salary.min ?? j.salaryPerYear)}
                            {j.job.salary.max && j.job.salary.min && j.job.salary.max !== j.job.salary.min
                              ? ` – ${new Intl.NumberFormat("de-DE", { style: "currency", currency: j.job.salary.currency, maximumFractionDigits: 0 }).format(j.job.salary.max)}`
                              : ""}
                          </strong>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>Gehalt nicht angegeben</span>
                        )}
                      </p>
                    </div>

                    <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start", flexWrap: "wrap" }}>
                      {j.job.isDemo && <Badge tone="caution">Demo</Badge>}
                      {j.listingConfidence.possiblyStale && <Badge tone="caution">evtl. veraltet</Badge>}
                      {j.listingConfidence.possibleRepost && <Badge tone="neutral">Wiederveroeffentlichung</Badge>}
                    </div>
                  </div>

                  {/* Die fuenf Bewertungen, getrennt */}
                  <div
                    className="scroll-x"
                    style={{ display: "flex", gap: "var(--space-6)", paddingBottom: 4 }}
                  >
                    <FitDisplay fit={j.fit} t={t} compact />
                    <ConfidenceDisplay confidence={j.confidence} t={t} />
                    <JobQualityDisplay quality={j.jobQuality} t={t} />
                    <AiTransitionDisplay ai={j.aiTransition} t={t} />
                    <ListingConfidenceDisplay listing={j.listingConfidence} t={t} />
                  </div>

                  {/* Ein Grund, ein Vorbehalt. Immer beide. */}
                  <div style={{ display: "grid", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
                    <p>
                      <strong style={{ color: "var(--positive)" }}>{t("jobs.mainReason")}:</strong>{" "}
                      {j.fit.topReason}
                    </p>
                    <p>
                      <strong style={{ color: "var(--caution)" }}>{t("jobs.mainReservation")}:</strong>{" "}
                      {j.fit.topReservation}
                    </p>
                  </div>

                  {blocked && (
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
                      <strong style={{ color: "var(--critical)" }}>{t("jobs.blockedBecause")}: </strong>
                      {j.constraints.checks
                        .filter((c) => c.verdict === "blocked")
                        .map((c) => c.reason)
                        .join(" ")}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
                    <Link href={`/app/jobs/${j.jobId}`} style={buttonStyle("secondary")}>
                      {t("jobs.view")}
                    </Link>
                    <SaveJobButton
                      jobId={j.jobId}
                      initiallySaved={savedIds.has(j.jobId)}
                      labels={{ save: t("jobs.save"), saved: t("jobs.saved") }}
                    />
                  </div>
                </Stack>
              </Card>
            );
          })}
        </ul>
      )}
    </Stack>
  );
}
