import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { getDb, schema, withUser } from "@paycheck/db";
import { evaluateGate } from "@paycheck/domain";
import { toInterviewSession } from "@/lib/rows";
import { and, desc, eq, isNull } from "drizzle-orm";
import { listJobsForUser, loadProfileContext, countSentApplications } from "@/lib/matching";
import { diagnoseFunnel } from "@/lib/funnel";
import { Badge, buttonStyle, Card, EmptyState, Stack } from "@/components/ui";
import { ConfidenceDisplay, FitDisplay } from "@/components/scores";

export const metadata: Metadata = { title: "Start" };
export const dynamic = "force-dynamic";

/**
 * Dashboard.
 *
 * Ueber der Falz stehen hoechstens drei Dinge: der naechste sinnvolle
 * Schritt, die besten Moeglichkeiten, der Stand der Bewerbungen. Alles
 * Weitere kommt darunter.
 *
 * Bewusst nicht enthalten: Streaks, Tagesziele, Countdown-Zaehler. Wer
 * Arbeit sucht, steht ohnehin unter Druck - das Produkt soll ihn nicht
 * vergroessern.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const { t, brand } = await getPageContext();
  const db = await getDb();

  const [ctx, sentCount] = await Promise.all([
    loadProfileContext(user.id),
    countSentApplications(user.id),
  ]);

  const [sessionRow] = await withUser(db, user.id, (tx) =>
    tx
      .select()
      .from(schema.interviewSessions)
      .where(eq(schema.interviewSessions.userId, user.id))
      .orderBy(desc(schema.interviewSessions.updatedAt))
      .limit(1),
  );

  const gate = evaluateGate(toInterviewSession(sessionRow), ctx.profileConfirmed);

  const applications = await withUser(db, user.id, (tx) =>
    tx
      .select({ app: schema.applications, jobTitle: schema.jobs.title, company: schema.companies.name })
      .from(schema.applications)
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(eq(schema.applications.userId, user.id))
      .orderBy(desc(schema.applications.updatedAt)),
  );

  const reminders = await withUser(db, user.id, (tx) =>
    tx
      .select()
      .from(schema.reminders)
      .where(and(eq(schema.reminders.userId, user.id), isNull(schema.reminders.completedAt)))
      .orderBy(schema.reminders.dueAt)
      .limit(3),
  );

  const topJobs = gate.unlocked
    ? (await listJobsForUser(user.id, ctx, { limit: 3 })).jobs
    : [];

  const funnel = await diagnoseFunnel(user.id);

  // Genau ein naechster Schritt. Die Reihenfolge ist die Rangfolge.
  const nextAction = !gate.unlocked
    ? {
        title: sessionRow
          ? `Dein Profil ist fast fertig — es fehlen noch ${gate.missingStages.length} Themen.`
          : `Lern ${brand.assistantName} kennen`,
        body: gate.reason,
        cta: sessionRow ? "Gespraech fortsetzen" : "Gespraech beginnen",
        href: "/app/nina",
      }
    : reminders[0]
      ? {
          title: reminders[0].label,
          body: `Faellig am ${new Intl.DateTimeFormat("de-DE").format(reminders[0].dueAt)}.`,
          cta: "Vorbereiten",
          href: "/app/applications",
        }
      : topJobs[0]
        ? {
            title: `${topJobs[0].job.title} bei ${topJobs[0].job.companyName}`,
            body: topJobs[0].fit.topReason,
            cta: "Ansehen",
            href: `/app/jobs/${topJobs[0].jobId}`,
          }
        : {
            title: "Sieh dir deine Auswahl an",
            body: "Dein Profil steht. Die Vorschlaege sind freigeschaltet.",
            cta: t("nav.jobs"),
            href: "/app/jobs",
          };

  return (
    <Stack gap={7}>
      {/* --- 1. Naechster Schritt --- */}
      <section aria-labelledby="naechster-schritt">
        <h2 id="naechster-schritt" style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "var(--space-3)" }}>
          Dein naechster Schritt
        </h2>
        <Card style={{ borderColor: "var(--assistant-border)", background: "var(--assistant-subtle)" }}>
          <Stack gap={4}>
            <div>
              <Badge tone="assistant">{brand.assistantName}</Badge>
              <h3 style={{ fontSize: "var(--text-xl)", marginTop: "var(--space-3)" }}>{nextAction.title}</h3>
              <p style={{ marginTop: "var(--space-2)", color: "var(--text-secondary)", maxWidth: "var(--measure)" }}>
                {nextAction.body}
              </p>
            </div>
            <div>
              <Link href={nextAction.href} style={buttonStyle("primary")}>
                {nextAction.cta}
              </Link>
            </div>
          </Stack>
        </Card>
      </section>

      {/* --- 2. Beste Moeglichkeiten --- */}
      <section aria-labelledby="moeglichkeiten">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "var(--space-4)" }}>
          <h2 id="moeglichkeiten" style={{ fontSize: "var(--text-lg)" }}>
            Deine besten aktuellen Moeglichkeiten
          </h2>
          {gate.unlocked && (
            <Link href="/app/jobs" style={{ fontSize: "var(--text-sm)", color: "var(--accent-text)" }}>
              Alle ansehen
            </Link>
          )}
        </div>

        {!gate.unlocked ? (
          <EmptyState
            title={t("jobs.locked")}
            body={t("jobs.lockedBody")}
            action={
              <Link href="/app/nina" style={buttonStyle("primary")}>
                {t("jobs.lockedCta")}
              </Link>
            }
          />
        ) : topJobs.length === 0 ? (
          <EmptyState title={t("states.emptyTitle")} body={t("jobs.emptyAll")} />
        ) : (
          <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
            {topJobs.map((j) => (
              <Card as="li" key={j.jobId}>
                <Stack gap={4}>
                  <div>
                    <Link href={`/app/jobs/${j.jobId}`} style={{ textDecoration: "none" }}>
                      <strong style={{ fontSize: "var(--text-lg)" }}>{j.job.title}</strong>
                    </Link>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", marginTop: 2 }}>
                      {j.job.companyName} · {j.job.location}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "var(--space-6)" }}>
                    <FitDisplay fit={j.fit} t={t} compact />
                    <ConfidenceDisplay confidence={j.confidence} t={t} />
                  </div>

                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{j.fit.topReason}</p>
                </Stack>
              </Card>
            ))}
          </ul>
        )}
      </section>

      {/* --- 3. Bewerbungsfortschritt --- */}
      <section aria-labelledby="fortschritt">
        <h2 id="fortschritt" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-4)" }}>
          Bewerbungsfortschritt
        </h2>
        {applications.length === 0 ? (
          <EmptyState title={t("states.emptyTitle")} body={t("applications.empty")} />
        ) : (
          <Card>
            <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-4)" }}>
              {applications.slice(0, 5).map(({ app, jobTitle, company }) => (
                <li
                  key={app.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "var(--space-4)",
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <Link href={`/app/applications/${app.id}`} style={{ textDecoration: "none", fontWeight: 500 }}>
                      {jobTitle}
                    </Link>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{company}</p>
                  </div>
                  <Badge
                    tone={
                      app.stage === "interview" || app.stage === "offer" || app.stage === "accepted"
                        ? "positive"
                        : app.stage === "rejected" || app.stage === "withdrawn"
                          ? "neutral"
                          : "accent"
                    }
                  >
                    {t(`applications.stage${app.stage.charAt(0).toUpperCase()}${app.stage.slice(1)}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* --- Weiteres, unterhalb --- */}
      <section aria-labelledby="weiteres" style={{ display: "grid", gap: "var(--space-5)", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" }}>
        <h2 id="weiteres" className="sr-only">
          Weitere Informationen
        </h2>

        <Card>
          <Stack gap={3}>
            <h3 style={{ fontSize: "var(--text-base)" }}>{t("profile.coverage")}</h3>
            <div aria-hidden style={{ height: 8, background: "var(--surface-inset)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
              <div style={{ width: `${Math.round(ctx.coverage * 100)}%`, height: "100%", background: "var(--accent)" }} />
            </div>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              {Math.round(ctx.coverage * 100)} % · {t("profile.coverageBody")}
            </p>
            <Link href="/app/profile" style={{ fontSize: "var(--text-sm)", color: "var(--accent-text)" }}>
              Profil ansehen
            </Link>
          </Stack>
        </Card>

        <Card>
          <Stack gap={3}>
            <h3 style={{ fontSize: "var(--text-base)" }}>{t("applications.funnelTitle")}</h3>
            {funnel.hasEnoughData ? (
              <>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{funnel.headline}</p>
                {funnel.findings.slice(0, 2).map((f) => (
                  <p key={f.key} style={{ fontSize: "var(--text-sm)" }}>
                    <strong>{f.title}:</strong> {f.suggestion}
                  </p>
                ))}
              </>
            ) : (
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                {t("applications.funnelTooFew")} Bisher: {sentCount} versendet.
              </p>
            )}
          </Stack>
        </Card>

        {reminders.length > 0 && (
          <Card>
            <Stack gap={3}>
              <h3 style={{ fontSize: "var(--text-base)" }}>Erinnerungen</h3>
              <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-3)" }}>
                {reminders.map((r) => (
                  <li key={r.id} style={{ fontSize: "var(--text-sm)" }}>
                    <strong>{r.label}</strong>
                    <br />
                    <span style={{ color: "var(--text-muted)" }}>
                      {new Intl.DateTimeFormat("de-DE").format(r.dueAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </Stack>
          </Card>
        )}
      </section>
    </Stack>
  );
}
