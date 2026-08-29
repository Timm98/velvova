import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { getDb, schema, withUser } from "@paycheck/db";
import { APPLICATION_PIPELINE } from "@paycheck/domain";
import { desc, eq } from "drizzle-orm";
import { diagnoseFunnel } from "@/lib/funnel";
import { Badge, buttonStyle, Card, EmptyState, PageHeader, Stack } from "@/components/ui";

export const metadata: Metadata = { title: "Bewerbungen" };
export const dynamic = "force-dynamic";

const STAGE_KEY: Record<string, string> = {
  saved: "applications.stageSaved",
  preparing: "applications.stagePreparing",
  sent: "applications.stageSent",
  acknowledged: "applications.stageAcknowledged",
  interview: "applications.stageInterview",
  offer: "applications.stageOffer",
  accepted: "applications.stageAccepted",
  rejected: "applications.stageRejected",
  withdrawn: "applications.stageWithdrawn",
};

function toneFor(stage: string) {
  if (stage === "offer" || stage === "accepted") return "positive" as const;
  if (stage === "interview") return "accent" as const;
  if (stage === "rejected" || stage === "withdrawn") return "neutral" as const;
  return "assistant" as const;
}

/**
 * Application Hub.
 *
 * Die Tafel zeigt die Pipeline, darunter steht die Trichterdiagnose -
 * und die schweigt ausdrücklich, solange die Stichprobe zu klein ist.
 * Ein Muster in drei Bewerbungen zu behaupten wäre geraten.
 */
export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireUser();
  const { t } = await getPageContext();
  const params = await searchParams;
  const view = params.view === "list" ? "list" : params.view === "calendar" ? "calendar" : "board";

  const db = await getDb();
  const rows = await withUser(db, user.id, (tx) =>
    tx
      .select({
        app: schema.applications,
        jobTitle: schema.jobs.title,
        company: schema.companies.name,
        jobId: schema.jobs.id,
      })
      .from(schema.applications)
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(eq(schema.applications.userId, user.id))
      .orderBy(desc(schema.applications.updatedAt)),
  );

  const funnel = await diagnoseFunnel(user.id);

  if (rows.length === 0) {
    return (
      <Stack gap={6}>
        <PageHeader title={t("applications.title")} />
        <EmptyState
          title={t("states.emptyTitle")}
          body={t("applications.empty")}
          action={
            <Link href="/app/jobs" style={buttonStyle("primary")}>
              {t("nav.jobs")}
            </Link>
          }
        />
      </Stack>
    );
  }

  const byStage = APPLICATION_PIPELINE.map((stage) => ({
    stage,
    items: rows.filter((r) => r.app.stage === stage),
  })).filter((g) => g.items.length > 0 || ["saved", "preparing", "sent", "interview"].includes(g.stage));

  const upcoming = rows
    .filter((r) => r.app.nextStepAt !== null)
    .sort((a, b) => (a.app.nextStepAt!.getTime() - b.app.nextStepAt!.getTime()));

  return (
    <Stack gap={6}>
      <PageHeader title={t("applications.title")} />

      {/* Ansichten */}
      <nav aria-label="Ansicht" style={{ display: "flex", gap: "var(--space-2)" }}>
        {[
          { key: "board", label: t("applications.viewKanban") },
          { key: "list", label: t("applications.viewList") },
          { key: "calendar", label: t("applications.viewCalendar") },
        ].map((v) => (
          <Link
            key={v.key}
            href={`/app/applications?view=${v.key}`}
            aria-current={view === v.key ? "true" : undefined}
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 40,
              padding: "var(--space-2) var(--space-4)",
              borderRadius: "var(--radius-full)",
              border: `1px solid ${view === v.key ? "var(--accent)" : "var(--border-default)"}`,
              background: view === v.key ? "var(--accent-subtle)" : "var(--surface-raised)",
              color: view === v.key ? "var(--accent-text)" : "var(--text-secondary)",
              fontSize: "var(--text-sm)",
              textDecoration: "none",
            }}
          >
            {v.label}
          </Link>
        ))}
      </nav>

      {view === "board" && (
        <div className="scroll-x" tabIndex={0} role="region" aria-label="Bewerbungen nach Stand">
          <div style={{ display: "flex", gap: "var(--space-4)", alignItems: "flex-start", paddingBottom: "var(--space-3)" }}>
            {byStage.map((group) => (
              <section
                key={group.stage}
                aria-labelledby={`stage-${group.stage}`}
                style={{ minWidth: 260, maxWidth: 300, flex: "0 0 auto" }}
              >
                <h2
                  id={`stage-${group.stage}`}
                  style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-3)", color: "var(--text-secondary)" }}
                >
                  {t(STAGE_KEY[group.stage]!)}{" "}
                  <span style={{ color: "var(--text-muted)" }}>({group.items.length})</span>
                </h2>
                <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-3)" }}>
                  {group.items.map((r) => (
                    <Card as="li" key={r.app.id} style={{ padding: "var(--space-4)" }}>
                      <Stack gap={2}>
                        <Link href={`/app/applications/${r.app.id}`} style={{ textDecoration: "none", fontWeight: 500 }}>
                          {r.jobTitle}
                        </Link>
                        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{r.company}</p>
                        {r.app.nextStepLabel && (
                          <p style={{ fontSize: "var(--text-xs)", color: "var(--accent-text)" }}>
                            {r.app.nextStepLabel}
                            {r.app.nextStepAt && ` · ${new Intl.DateTimeFormat("de-DE").format(r.app.nextStepAt)}`}
                          </p>
                        )}
                      </Stack>
                    </Card>
                  ))}
                  {group.items.length === 0 && (
                    <li style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", padding: "var(--space-3)" }}>
                      Nichts hier.
                    </li>
                  )}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}

      {view === "list" && (
        <Card padded={false}>
          <ul style={{ listStyle: "none" }}>
            {rows.map((r, i) => (
              <li
                key={r.app.id}
                style={{
                  display: "flex",
                  gap: "var(--space-4)",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "var(--space-4) var(--space-5)",
                  borderTop: i === 0 ? "none" : "1px solid var(--border-subtle)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <Link href={`/app/applications/${r.app.id}`} style={{ textDecoration: "none", fontWeight: 500 }}>
                    {r.jobTitle}
                  </Link>
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                    {r.company}
                    {r.app.lastContactAt &&
                      ` · ${t("applications.lastContact")}: ${new Intl.DateTimeFormat("de-DE").format(r.app.lastContactAt)}`}
                  </p>
                </div>
                <Badge tone={toneFor(r.app.stage)}>{t(STAGE_KEY[r.app.stage]!)}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {view === "calendar" && (
        <Card>
          <Stack gap={4}>
            <h2 style={{ fontSize: "var(--text-base)" }}>Anstehende Termine und Fristen</h2>
            {upcoming.length === 0 ? (
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                {t("applications.noNextStep")}
              </p>
            ) : (
              <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-4)" }}>
                {upcoming.map((r) => (
                  <li key={r.app.id} style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
                    <strong style={{ minWidth: 110 }}>
                      {new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "long" }).format(r.app.nextStepAt!)}
                    </strong>
                    <span>
                      <Link href={`/app/applications/${r.app.id}`} style={{ textDecoration: "none" }}>
                        {r.app.nextStepLabel ?? "Nächster Schritt"}
                      </Link>
                      <br />
                      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                        {r.jobTitle} · {r.company}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Stack>
        </Card>
      )}

      {/* --- Trichterdiagnose --- */}
      <section aria-labelledby="funnel">
        <h2 id="funnel" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
          {t("applications.funnelTitle")}
        </h2>
        <Card>
          <Stack gap={4}>
            <p style={{ color: "var(--text-secondary)" }}>{funnel.headline}</p>

            {/* Der scrollbare Rahmen liegt UM die Liste, nicht auf ihr:
                ein role="region" auf dem <dl> nimmt der Liste ihre
                Semantik, und die <dt>/<dd> verlieren ihren Bezug. */}
            <div
              className="scroll-x"
              tabIndex={0}
              role="region"
              aria-label="Zahlen des Bewerbungstrichters"
            >
            <dl style={{ display: "flex", gap: "var(--space-6)", margin: 0, paddingBottom: 4 }}>
              {[
                ["Angesehen", funnel.counts.viewed],
                ["Gemerkt", funnel.counts.saved],
                ["Begonnen", funnel.counts.started],
                ["Versendet", funnel.counts.sent],
                ["Rückmeldung", funnel.counts.acknowledged],
                ["Gespräche", funnel.counts.interviews],
                ["Angebote", funnel.counts.offers],
              ].map(([label, value]) => (
                <div key={label as string} style={{ whiteSpace: "nowrap" }}>
                  <dt style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase" }}>
                    {label}
                  </dt>
                  <dd style={{ margin: 0, fontSize: "var(--text-xl)", fontWeight: 600 }}>{value}</dd>
                </div>
              ))}
            </dl>
            </div>

            {funnel.findings.length > 0 && (
              <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-4)" }}>
                {funnel.findings.map((f) => (
                  <li key={f.key} style={{ display: "grid", gap: "var(--space-2)" }}>
                    <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "var(--text-sm)" }}>{f.title}</strong>
                      <Badge tone={f.certainty === "muster" ? "accent" : "neutral"}>{f.certainty}</Badge>
                    </div>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{f.observation}</p>
                    <p style={{ fontSize: "var(--text-sm)" }}>{f.suggestion}</p>
                  </li>
                ))}
              </ul>
            )}

            <p
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--text-muted)",
                borderTop: "1px solid var(--border-subtle)",
                paddingTop: "var(--space-3)",
                maxWidth: "var(--measure)",
              }}
            >
              {funnel.limits}
            </p>
          </Stack>
        </Card>
      </section>
    </Stack>
  );
}
