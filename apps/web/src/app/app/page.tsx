import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, Briefcase, Sparkles, Target } from "lucide-react";
import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { countSentApplications, listJobsForUser, loadProfileContext } from "@/lib/matching";
import { loadGate } from "@/lib/gate";
import { diagnoseFunnel } from "@/lib/funnel";
import { Badge, Button, Card, Separator } from "@/components/ui";
import { ConfidenceMeter, ScoreRing, StatTile } from "@/components/ui/score";
import { EmptyState, Section } from "@/components/ui/states";

export const metadata: Metadata = { title: "Start" };
export const dynamic = "force-dynamic";

/**
 * Das Dashboard.
 *
 * Über der Falz stehen höchstens drei Dinge: der nächste sinnvolle
 * Schritt, die besten Möglichkeiten, der Stand der Bewerbungen.
 *
 * Bewusst nicht enthalten: Streaks, Tagesziele, Countdown-Zähler. Wer
 * Arbeit sucht, steht ohnehin unter Druck — das Produkt darf ihn nicht
 * vergrößern.
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const { t, brand } = await getPageContext();
  const db = await getDb();

  const [ctx, sentCount, gate] = await Promise.all([
    loadProfileContext(user.id),
    countSentApplications(user.id),
    loadGate(user.id),
  ]);

  const [applications, reminders] = await Promise.all([
    withUser(db, user.id, (tx) =>
      tx
        .select({
          app: schema.applications,
          jobTitle: schema.jobs.title,
          company: schema.companies.name,
        })
        .from(schema.applications)
        .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
        .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
        .where(eq(schema.applications.userId, user.id))
        .orderBy(desc(schema.applications.updatedAt)),
    ),
    withUser(db, user.id, (tx) =>
      tx
        .select()
        .from(schema.reminders)
        .where(and(eq(schema.reminders.userId, user.id), isNull(schema.reminders.completedAt)))
        .orderBy(schema.reminders.dueAt)
        .limit(3),
    ),
  ]);

  const topJobs = gate.unlocked ? (await listJobsForUser(user.id, ctx, { limit: 3 })).jobs : [];
  const funnel = await diagnoseFunnel(user.id);

  // Genau eine nächste Handlung. Die Reihenfolge hier ist die Rangfolge.
  const next = !gate.unlocked
    ? {
        title: gate.hasAnySession
          ? `Noch ${gate.missingStages.length} Themen bis zu deinem Profil`
          : `Lern ${brand.assistantName} kennen`,
        body: gate.reason,
        cta: gate.hasAnySession ? "Gespräch fortsetzen" : "Gespräch beginnen",
        href: "/app/nina",
      }
    : reminders[0]
      ? {
          title: reminders[0].label,
          body: `Fällig am ${new Intl.DateTimeFormat("de-DE").format(reminders[0].dueAt)}.`,
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
            body: "Dein Profil steht. Die Vorschläge sind freigeschaltet.",
            cta: t("nav.jobs"),
            href: "/app/jobs",
          };

  const activeCount = applications.filter(
    (a) => !["rejected", "withdrawn", "accepted"].includes(a.app.stage),
  ).length;

  const bandText = (band: string) =>
    band === "high"
      ? t("jobs.fitHigh")
      : band === "medium"
        ? t("jobs.fitMedium")
        : band === "exploratory"
          ? t("jobs.fitExploratory")
          : t("jobs.fitInsufficient");

  return (
    <div className="grid gap-12">
      <div className="grid gap-1.5">
        <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-3">
          {new Intl.DateTimeFormat("de-DE", {
            weekday: "long",
            day: "numeric",
            month: "long",
          }).format(new Date())}
        </p>
        <h1 className="text-3xl font-semibold">
          {user.displayName ? `Hallo ${user.displayName.split(" ")[0]}` : "Willkommen zurück"}
        </h1>
      </div>

      {/* ── 1. Der nächste Schritt ───────────────────────────────── */}
      <Card padded={false} className="overflow-hidden border-assistant-border">
        <div className="surface-gradient bg-assistant-soft px-6 py-7 md:px-8 md:py-8">
          <Badge tone="assistant">
            <Sparkles className="size-3" strokeWidth={2} />
            {brand.assistantName}
          </Badge>
          <h2 className="mt-4 max-w-[34ch] text-xl font-semibold md:text-2xl">{next.title}</h2>
          <p className="mt-3 max-w-[var(--measure)] leading-relaxed text-ink-2">{next.body}</p>
          <div className="mt-6">
            <Button asChild variant="primary">
              <Link href={next.href}>
                {next.cta}
                <ArrowRight className="size-4" strokeWidth={1.9} />
              </Link>
            </Button>
          </div>
        </div>
      </Card>

      {/* ── 2. Beste Möglichkeiten ───────────────────────────────── */}
      <Section
        title="Deine besten Möglichkeiten"
        action={
          gate.unlocked ? (
            <Link
              href="/app/jobs"
              className="inline-flex items-center gap-1.5 text-sm text-accent-text underline underline-offset-[3px]"
            >
              Alle ansehen
              <ArrowRight className="size-3.5" strokeWidth={1.9} />
            </Link>
          ) : undefined
        }
      >
        {!gate.unlocked ? (
          <EmptyState
            icon={<Target className="size-5" strokeWidth={1.7} />}
            title={t("jobs.locked")}
            body={t("jobs.lockedBody")}
            action={
              <Button asChild variant="primary">
                <Link href="/app/nina">{t("jobs.lockedCta")}</Link>
              </Button>
            }
          />
        ) : topJobs.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="size-5" strokeWidth={1.7} />}
            title={t("states.emptyTitle")}
            body={t("jobs.emptyAll")}
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-3">
            {topJobs.map((j) => (
              <Card as="li" key={j.jobId} interactive padded={false} className="flex flex-col p-5">
                <Link href={`/app/jobs/${j.jobId}`} className="min-w-0">
                  <h3 className="line-clamp-2 font-semibold leading-snug">{j.job.title}</h3>
                  <p className="mt-1 truncate text-sm text-ink-3">
                    {j.job.companyName} · {j.job.location}
                  </p>
                </Link>

                <div className="my-4">
                  <Separator soft />
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  <ScoreRing
                    value={j.fit.score}
                    label={t("jobs.fit")}
                    band={bandText(j.fit.band)}
                    size="sm"
                  />
                  <ConfidenceMeter level={j.confidence.level} label={t("jobs.confidence")} />
                </div>

                <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-ink-2">
                  {j.fit.topReason}
                </p>
              </Card>
            ))}
          </ul>
        )}
      </Section>

      {/* ── 3. Bewerbungsfortschritt ─────────────────────────────── */}
      <Section
        title="Bewerbungsfortschritt"
        action={
          applications.length > 0 ? (
            <Link
              href="/app/applications"
              className="inline-flex items-center gap-1.5 text-sm text-accent-text underline underline-offset-[3px]"
            >
              Alle ansehen
              <ArrowRight className="size-3.5" strokeWidth={1.9} />
            </Link>
          ) : undefined
        }
      >
        {applications.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="size-5" strokeWidth={1.7} />}
            title={t("states.emptyTitle")}
            body={t("applications.empty")}
          />
        ) : (
          <Card padded={false}>
            <div className="grid grid-cols-3 gap-6 border-b border-line px-6 py-5">
              <StatTile label="Laufend" value={activeCount} />
              <StatTile label="Versendet" value={funnel.counts.sent} />
              <StatTile label="Gespräche" value={funnel.counts.interviews} />
            </div>

            <ul className="divide-y divide-line">
              {applications.slice(0, 5).map(({ app, jobTitle, company }) => (
                <li key={app.id}>
                  <Link
                    href={`/app/applications/${app.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-sunken"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{jobTitle}</span>
                      <span className="block truncate text-sm text-ink-3">{company}</span>
                    </span>
                    <Badge
                      tone={
                        ["offer", "accepted"].includes(app.stage)
                          ? "positive"
                          : app.stage === "interview"
                            ? "accent"
                            : ["rejected", "withdrawn"].includes(app.stage)
                              ? "neutral"
                              : "assistant"
                      }
                    >
                      {t(
                        `applications.stage${app.stage.charAt(0).toUpperCase()}${app.stage.slice(1)}`,
                      )}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Section>

      {/* ── Weiteres ─────────────────────────────────────────────── */}
      <section aria-label="Weitere Informationen" className="grid gap-4 md:grid-cols-2">
        <Card>
          <h3 className="text-base font-semibold">{t("profile.coverage")}</h3>
          <div className="mt-4 flex items-center gap-4">
            <span className="text-2xl font-semibold tabular leading-none">
              {Math.round(ctx.coverage * 100)}
              <span className="text-base font-normal text-ink-3"> %</span>
            </span>
            <div aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-inset">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-[--duration-slow] ease-[--ease-out]"
                style={{ width: `${Math.round(ctx.coverage * 100)}%` }}
              />
            </div>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">{t("profile.coverageBody")}</p>
          <p className="mt-4">
            <Link
              href="/app/profile"
              className="inline-flex items-center gap-1.5 text-sm text-accent-text underline underline-offset-[3px]"
            >
              Profil ansehen
              <ArrowRight className="size-3.5" strokeWidth={1.9} />
            </Link>
          </p>
        </Card>

        <Card>
          <h3 className="text-base font-semibold">{t("applications.funnelTitle")}</h3>
          {funnel.hasEnoughData ? (
            <div className="mt-3 grid gap-3">
              <p className="text-sm leading-relaxed text-ink-2">{funnel.headline}</p>
              {funnel.findings.slice(0, 2).map((f) => (
                <p key={f.key} className="text-sm leading-relaxed">
                  <span className="font-medium">{f.title}: </span>
                  <span className="text-ink-2">{f.suggestion}</span>
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              {t("applications.funnelTooFew")} Bisher: {sentCount} versendet.
            </p>
          )}
        </Card>
      </section>

      {reminders.length > 0 && (
        <Section title="Erinnerungen">
          <Card padded={false}>
            <ul className="divide-y divide-line">
              {reminders.map((r) => (
                <li key={r.id} className="flex items-start gap-3 px-6 py-4">
                  <Bell className="mt-0.5 size-4 shrink-0 text-ink-3" strokeWidth={1.8} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{r.label}</span>
                    <span className="block text-sm text-ink-3">
                      {new Intl.DateTimeFormat("de-DE", {
                        day: "numeric",
                        month: "long",
                      }).format(r.dueAt)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      )}
    </div>
  );
}
