import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Clock, ExternalLink, HelpCircle, MapPin } from "lucide-react";
import { eq, and } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { coverLetterAdvisable } from "@paycheck/documents";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { loadScoredJob } from "@/lib/matching";
import { Badge, Card, Disclosure, Separator } from "@/components/ui";
import { ConfidenceMeter, MetricValue, ScoreRing } from "@/components/ui/score";
import { SourceNote } from "@/components/ui/states";
import { BlockedNotice, FactorBreakdown } from "@/components/scores";
import { JobActions } from "./JobActions";
import { NinaPanel } from "./NinaPanel";
import { ViewTracker } from "./ViewTracker";
import { NinaScope } from "@/components/nina/NinaScope";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  const scored = await loadScoredJob(user.id, id);
  return { title: scored ? scored.job.title : "Stelle" };
}

const SOURCE_KIND_LABEL: Record<string, string> = {
  employee_reviews: "Mitarbeiterstimmen",
  customer_reviews: "Kundenbewertungen",
  employer_statement: "Angabe des Arbeitgebers",
  official_registry: "Offizielles Register",
  journalistic: "Journalistische Quelle",
  regulatory: "Behördliche Quelle",
  user_report: "Hinweis von Nutzenden",
};

const AI_LABEL: Record<string, string> = {
  strongly_augmentable: "stark augmentierbar",
  partly_transformable: "teilweise transformierbar",
  relatively_robust: "relativ robust",
  unclear_data: "Datenbasis unklar",
};

const WORK_MODEL: Record<string, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  on_site: "Vor Ort",
};

const CONTRACT: Record<string, string> = {
  permanent: "Unbefristet",
  fixed_term: "Befristet",
  internship: "Praktikum",
  working_student: "Werkstudium",
  apprenticeship: "Ausbildung",
  freelance: "Freiberuflich",
  temp_agency: "Zeitarbeit",
};

/**
 * Job Reality Check.
 *
 * Diese Seite ist ausdrücklich keine kopierte Stellenanzeige. Sie
 * beantwortet vier Fragen, die eine Anzeige nicht beantwortet: passt das
 * zu mir und wie sicher ist das, wie gut ist die Stelle als
 * Arbeitsplatz, wie verändern sich die Aufgaben, und wie
 * vertrauenswürdig ist die Anzeige selbst.
 *
 * Der Aufbau folgt dieser Reihenfolge. Rechts steht, was zum Handeln
 * nötig ist, und es bleibt beim Scrollen stehen — die Entscheidung soll
 * nicht davon abhängen, wie weit man gerade gelesen hat.
 */
export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { t, brand } = await getPageContext();

  const scored = await loadScoredJob(user.id, id);
  if (!scored) notFound();

  const {
    job,
    fit,
    confidence,
    jobQuality,
    aiTransition,
    listingConfidence,
    constraints,
    requirements,
    reviews,
    themes,
    source,
  } = scored;

  const db = await getDb();
  const savedRow = await withUser(db, user.id, (tx) =>
    tx
      .select({ jobId: schema.savedJobs.jobId })
      .from(schema.savedJobs)
      .where(and(eq(schema.savedJobs.userId, user.id), eq(schema.savedJobs.jobId, job.id)))
      .limit(1),
  );

  const musts = requirements.filter((r) => r.kind === "must");
  const nices = requirements.filter((r) => r.kind === "nice");
  const coverLetter = coverLetterAdvisable(job);
  const employeeReviews = reviews.filter((r) => r.sourceKind === "employee_reviews");
  const otherReviews = reviews.filter((r) => r.sourceKind !== "employee_reviews");

  const bandText =
    fit.band === "high"
      ? t("jobs.fitHigh")
      : fit.band === "medium"
        ? t("jobs.fitMedium")
        : fit.band === "exploratory"
          ? t("jobs.fitExploratory")
          : t("jobs.fitInsufficient");

  const money = (value: number) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: job.salary.currency,
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className="grid gap-8">
      {/* Nina weiß ab hier, worüber gesprochen wird. */}
      <NinaScope jobId={job.id} />
      <ViewTracker jobId={job.id} />

      <p>
        <Link
          href="/app/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-ink-2 transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.9} />
          Zurück zur Auswahl
        </Link>
      </p>

      {/* ══ Kopf ══════════════════════════════════════════════ */}
      <header className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="outline">Quelle: {source?.displayName ?? "unbekannt"}</Badge>
          {listingConfidence.possiblyStale && (
            <Badge tone="caution">{t("jobDetail.staleWarning")}</Badge>
          )}
          {constraints.overall === "blocked" && <Badge tone="critical">Ausschlusskriterium</Badge>}
        </div>

        {/* Aus der Skala statt aus freien Pixelwerten: 36 und 42px, beide
            in der Spanne 34–44 für Jobtitel im Detail. Der alte Wert
            2.1rem lag mit 33,6px knapp darunter. */}
        <h1 className="max-w-[24ch] font-display text-3xl font-medium leading-[1.1] tracking-[-0.02em] lg:text-4xl">
          {job.title}
        </h1>

        <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
          <li className="flex items-center gap-1.5">
            <Building2 className="size-3.5 shrink-0 text-ink-3" strokeWidth={1.8} />
            {job.companyName}
          </li>
          <li className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0 text-ink-3" strokeWidth={1.8} />
            {job.location} · {WORK_MODEL[job.workModel] ?? job.workModel}
            {job.remotePercent !== null && ` (${job.remotePercent} % remote)`}
          </li>
          {job.contractType && <li>{CONTRACT[job.contractType] ?? job.contractType}</li>}
          <li className="flex items-center gap-1.5">
            <Clock className="size-3.5 shrink-0 text-ink-3" strokeWidth={1.8} />
            {job.publishedAt
              ? `veröffentlicht ${new Intl.DateTimeFormat("de-DE").format(job.publishedAt)}`
              : "Veröffentlichungsdatum nicht angegeben"}
          </li>
        </ul>

        <p className="text-lg">
          {job.salary.disclosed ? (
            <span className="font-semibold">
              {money(job.salary.min ?? job.salary.max ?? 0)}
              {job.salary.max && job.salary.min && job.salary.max !== job.salary.min
                ? ` – ${money(job.salary.max)}`
                : ""}
              <span className="text-sm font-normal text-ink-3"> pro Jahr</span>
            </span>
          ) : (
            <span className="text-base text-ink-3">
              Gehalt nicht angegeben — das ist keine schlechte Angabe, sondern gar keine.
            </span>
          )}
        </p>
      </header>

      <BlockedNotice constraints={constraints} t={t} />

      {/* ══ Zwei Spalten ═════════════════════════════════════ */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
        <div className="grid min-w-0 gap-8">
          {/* Warum diese Stelle */}
          <Card className="border-assistant-border bg-assistant-soft">
            <Badge tone="assistant">{t("jobDetail.whyShown")}</Badge>
            <p className="mt-4 max-w-[var(--measure)] leading-relaxed">{fit.topReason}</p>
            <p className="mt-3 max-w-[var(--measure)] leading-relaxed text-ink-2">
              <span className="font-medium text-ink">Was dagegen spricht: </span>
              {fit.topReservation}
            </p>
            {confidence.reducedBy.length > 0 && (
              <>
                <div className="my-4">
                  <Separator soft />
                </div>
                <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
                  <span className="font-medium text-ink">Warum die Sicherheit nicht höher ist: </span>
                  {confidence.reducedBy.join(" ")}
                </p>
              </>
            )}
          </Card>

          {/* Aufgaben */}
          <section aria-labelledby="alltag" className="grid gap-4">
            <h2 id="alltag" className="text-xl font-semibold">
              Der Arbeitsalltag
            </h2>

            {job.coreTasks.length > 0 ? (
              <Card>
                <h3 className="text-base font-semibold">{t("jobDetail.coreTasks")}</h3>
                <ul className="mt-3.5 grid gap-2.5">
                  {job.coreTasks.map((task) => (
                    <li key={task} className="flex gap-2.5 text-sm leading-relaxed">
                      <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-ink-3" />
                      <span className="text-ink-2">{task}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : (
              <Card className="bg-sunken shadow-none">
                <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
                  Die Anzeige beschreibt keine konkreten Aufgaben. Das ist der wichtigste Punkt, den
                  du im Erstgespräch klären solltest — ohne Aufgaben lässt sich weder Passung noch
                  Entwicklung einschätzen.
                </p>
              </Card>
            )}

            <Disclosure summary="Vollständige Stellenbeschreibung">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">
                {job.description}
              </p>
            </Disclosure>
          </section>

          {/* Anforderungen */}
          <section aria-labelledby="anforderungen" className="grid gap-4">
            <h2 id="anforderungen" className="text-xl font-semibold">
              Anforderungen
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <h3 className="text-base font-semibold">{t("jobDetail.mustHave")}</h3>
                {musts.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-3">
                    Die Anzeige nennt keine zwingenden Anforderungen.
                  </p>
                ) : (
                  <ul className="mt-3.5 grid gap-2.5">
                    {musts.map((r) => (
                      <li key={r.id} className="text-sm leading-relaxed text-ink-2">
                        {r.text}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <h3 className="text-base font-semibold">{t("jobDetail.niceToHave")}</h3>
                {nices.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-3">Keine genannt.</p>
                ) : (
                  <ul className="mt-3.5 grid gap-2.5">
                    {nices.map((r) => (
                      <li key={r.id} className="text-sm leading-relaxed text-ink-2">
                        {r.text}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <Card>
              <FactorBreakdown factors={fit.factors} title="Woraus die Passung entsteht" />
            </Card>

            <Card>
              <h3 className="text-base font-semibold">Deine Bedingungen, einzeln geprüft</h3>
              <ul className="mt-4 grid gap-3">
                {constraints.checks.map((c) => (
                  <li key={c.key} className="flex flex-wrap items-start gap-3">
                    <span className="w-[92px] shrink-0">
                      <Badge
                        tone={
                          c.verdict === "eligible"
                            ? "positive"
                            : c.verdict === "blocked"
                              ? "critical"
                              : "neutral"
                        }
                      >
                        {c.verdict === "eligible"
                          ? "erfüllt"
                          : c.verdict === "blocked"
                            ? "verletzt"
                            : "unbekannt"}
                      </Badge>
                    </span>
                    <span className="min-w-0 flex-1 text-sm leading-relaxed">
                      <span className="font-medium">{c.label}: </span>
                      <span className="text-ink-2">{c.reason}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          {/* Jobqualität */}
          <section aria-labelledby="qualitaet" className="grid gap-4">
            <h2 id="qualitaet" className="text-xl font-semibold">
              {t("jobDetail.tabQuality")}
            </h2>
            <Card>
              {jobQuality.insufficientData && (
                <p className="mb-5 max-w-[var(--measure)] leading-relaxed text-ink-2">
                  Die Jobqualität lässt sich hier nicht ausreichend beurteilen. Das ist ausdrücklich{" "}
                  <span className="font-medium text-ink">kein schlechtes Ergebnis</span> — es liegen
                  schlicht zu wenige belastbare Angaben vor.
                </p>
              )}
              <FactorBreakdown
                factors={jobQuality.dimensions}
                title={jobQuality.insufficientData ? "Was bekannt ist und was fehlt" : "Die Dimensionen"}
              />
            </Card>
          </section>

          {/* KI und Zukunft */}
          <section aria-labelledby="zukunft" className="grid gap-4">
            <h2 id="zukunft" className="text-xl font-semibold">
              {t("jobDetail.tabFuture")}
            </h2>

            <Card>
              <p className="max-w-[var(--measure)] leading-relaxed text-ink-2">
                Bewertet werden die Aufgaben dieser Rolle, nicht der Berufstitel. Ob sich etwas
                ändert, hängt daran, woraus die Arbeit tatsächlich besteht — nicht daran, wie sie
                heißt.{" "}
                {aiTransition.dataAsOf
                  ? `Datenstand: ${new Intl.DateTimeFormat("de-DE").format(aiTransition.dataAsOf)}.`
                  : "Zur zugrunde liegenden Marktlage liegen uns keine datierten Quellen vor."}
              </p>

              {aiTransition.tasks.length === 0 ? (
                <p className="mt-4 text-sm text-ink-3">
                  Ohne beschriebene Aufgaben ist keine Aussage möglich.
                </p>
              ) : (
                <ul className="mt-5 grid gap-5">
                  {aiTransition.tasks.map((task) => (
                    <li key={task.task} className="grid gap-1.5">
                      <span className="text-sm font-medium">{task.task}</span>
                      <span className="text-sm leading-relaxed text-ink-2">{task.likelyChange}</span>
                      <span className="text-sm leading-relaxed text-ink-3">
                        Menschlicher Kern: {task.humanCore}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {aiTransition.scenarios.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {aiTransition.scenarios.map((s) => (
                  <Card key={s.title} className="p-5">
                    <h3 className="text-base font-semibold">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-2">{s.description}</p>
                  </Card>
                ))}
              </div>
            )}

            {aiTransition.complementarySkills.length > 0 && (
              <Card>
                <h3 className="text-base font-semibold">Was diese Rolle robuster macht</h3>
                <ul className="mt-3.5 flex flex-wrap gap-2">
                  {aiTransition.complementarySkills.map((s) => (
                    <li
                      key={s}
                      className="rounded-(--radius-full) border border-line-2 bg-sunken px-3 py-1.5 text-sm text-ink-2"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>

          {/* Unternehmensrealität */}
          <section aria-labelledby="unternehmen" className="grid gap-4">
            <div>
              <h2 id="unternehmen" className="text-xl font-semibold">
                {t("jobDetail.tabCompany")}
              </h2>
              <p className="mt-1.5 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
                Die Quellenarten bleiben getrennt. Eine Standortbewertung von Kundinnen und Kunden
                sagt nichts darüber aus, wie es sich dort arbeitet.
              </p>
            </div>

            {reviews.length === 0 ? (
              <Card className="bg-sunken shadow-none">
                <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
                  Zu diesem Unternehmen liegen keine externen Informationen vor. Das senkt die
                  Sicherheit der Einschätzung, sagt aber nichts über das Unternehmen aus.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {[...employeeReviews, ...otherReviews].map((r) => {
                  const relevantThemes = themes.filter((th) => th.aggregateId === r.id);
                  const smallSample = (r.sampleSize ?? 0) > 0 && (r.sampleSize ?? 0) < 15;

                  return (
                    <Card key={r.id} className="grid gap-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge tone={r.sourceKind === "employee_reviews" ? "assistant" : "neutral"}>
                          {SOURCE_KIND_LABEL[r.sourceKind] ?? r.sourceKind}
                        </Badge>
                        {r.ratingAverage !== null && (
                          <span className="text-lg font-semibold tabular">
                            {r.ratingAverage.toFixed(1)}
                            <span className="text-sm font-normal text-ink-3">
                              {" "}
                              / {r.ratingScaleMax}
                            </span>
                          </span>
                        )}
                      </div>

                      {r.sourceKind === "customer_reviews" && (
                        <p className="rounded-(--radius-md) bg-caution-soft px-4 py-3 text-sm leading-relaxed text-ink-2">
                          Das sind Kundenurteile über den Standort oder das Produkt. Sie sagen nichts
                          über Arbeitsbedingungen und dürfen dafür nicht herangezogen werden.
                        </p>
                      )}

                      {smallSample && (
                        <p className="text-sm leading-relaxed text-ink-2">
                          {t("jobDetail.smallSample")}
                        </p>
                      )}

                      {relevantThemes.length > 0 && (
                        <div>
                          <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                            Wiederkehrende Themen
                            <Badge tone="assistant">{t("jobDetail.aiSummary")}</Badge>
                          </h3>
                          <ul className="mt-3 grid gap-3">
                            {relevantThemes.map((th) => (
                              <li key={th.id} className="text-sm leading-relaxed">
                                <span
                                  className={
                                    th.sentiment === "positive"
                                      ? "font-medium text-positive"
                                      : th.sentiment === "negative"
                                        ? "font-medium text-critical"
                                        : "font-medium text-caution"
                                  }
                                >
                                  {th.theme}
                                </span>
                                <span className="text-ink-3"> ({th.mentionCount} Nennungen)</span>
                                <br />
                                <span className="text-ink-2">{th.summary}</span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-3 text-xs leading-relaxed text-ink-3">
                            {t("jobDetail.aiSummaryNote")}
                          </p>
                        </div>
                      )}

                      {r.selectionNote && (
                        <p className="text-xs leading-relaxed text-ink-3">
                          Auswahllogik der Quelle: {r.selectionNote}
                        </p>
                      )}

                      <SourceNote
                        sourceName={r.sourceName}
                        sourceUrl={r.sourceUrl}
                        retrievedAt={r.fetchedAt}
                        kind={SOURCE_KIND_LABEL[r.sourceKind] ?? r.sourceKind}
                        extra={
                          r.sampleSize !== null
                            ? `Stichprobe ${r.sampleSize}${r.locationScope ? `, ${r.locationScope}` : ""}`
                            : null
                        }
                      />
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* Fragen */}
          <section aria-labelledby="fragen" className="grid gap-4">
            <h2 id="fragen" className="text-xl font-semibold">
              {t("jobDetail.questionsToAsk")}
            </h2>
            <Card>
              <p className="text-sm leading-relaxed text-ink-2">
                Diese Fragen leiten sich aus dem ab, was in der Anzeige fehlt oder unklar bleibt.
              </p>
              <ul className="mt-4 grid gap-3">
                {buildQuestions(scored).map((q) => (
                  <li key={q} className="flex gap-2.5 text-sm leading-relaxed">
                    <HelpCircle className="mt-[3px] size-3.5 shrink-0 text-accent" strokeWidth={2} />
                    {q}
                  </li>
                ))}
              </ul>
            </Card>
          </section>

          {/* Quellen */}
          <section aria-labelledby="quellen" className="grid gap-4">
            <h2 id="quellen" className="text-xl font-semibold">
              {t("jobDetail.tabSource")}
            </h2>
            <Card className="grid gap-5">
              <dl className="grid gap-2.5 text-sm">
                <Row label="Quelle" value={source?.displayName ?? "unbekannt"} />
                <Row label="Lizenzstatus" value={source?.licenseStatus ?? "unklar"} />
                <Row
                  label="Veröffentlicht"
                  value={
                    job.publishedAt
                      ? new Intl.DateTimeFormat("de-DE").format(job.publishedAt)
                      : "nicht angegeben"
                  }
                />
                <Row
                  label="Zuletzt abgerufen"
                  value={new Intl.DateTimeFormat("de-DE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(job.fetchedAt)}
                />
                <Row
                  label="Letzter Linkcheck"
                  value={
                    job.lastLinkCheckAt
                      ? `${new Intl.DateTimeFormat("de-DE").format(job.lastLinkCheckAt)} — ${job.lastLinkCheckOk ? "erreichbar" : "nicht erreichbar"}`
                      : "noch nicht geprüft"
                  }
                />
              </dl>

              <Separator soft />

              <div>
                <h3 className="text-base font-semibold">
                  Woraus sich das Vertrauen in die Anzeige ergibt
                </h3>
                <ul className="mt-3.5 grid gap-2.5">
                  {listingConfidence.signals.map((s) => (
                    <li key={s.key} className="flex gap-2.5 text-sm leading-relaxed">
                      <span
                        aria-hidden
                        className={
                          s.ok === true
                            ? "text-positive"
                            : s.ok === false
                              ? "text-critical"
                              : "text-ink-3"
                        }
                      >
                        {s.ok === true ? "✓" : s.ok === false ? "✕" : "?"}
                      </span>
                      <span>
                        <span className="font-medium">{s.label}: </span>
                        <span className="text-ink-2">{s.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            <p className="text-xs leading-relaxed text-ink-3">
              {coverLetter.advisable
                ? "Diese Stelle verlangt ein Anschreiben."
                : `Anschreiben: ${coverLetter.reason}`}{" "}
              · Alle Werte stammen aus Bewertungsfassung {fit.version} von {brand.name}.
            </p>
          </section>
        </div>

        {/* ══ Seitenspalte ═══════════════════════════════════ */}
        <aside className="grid content-start gap-4 lg:sticky lg:top-[76px] lg:self-start">
          <Card className="grid gap-5">
            <div className="grid gap-4">
              <ScoreRing value={fit.score} label={t("jobs.fit")} band={bandText} size="lg" />
              <ConfidenceMeter level={confidence.level} label={t("jobs.confidence")} />
            </div>

            <Separator soft />

            <div className="grid gap-3.5">
              <MetricValue
                label={t("jobs.jobQuality")}
                value={
                  jobQuality.insufficientData
                    ? "nicht ausreichend beurteilbar"
                    : `${jobQuality.score} / 100`
                }
                tone={jobQuality.insufficientData ? "muted" : "default"}
              />
              <MetricValue
                label={t("jobs.aiTransition")}
                value={AI_LABEL[aiTransition.category] ?? aiTransition.category}
                tone={aiTransition.category === "unclear_data" ? "muted" : "default"}
              />
              <MetricValue
                label={t("jobs.listingConfidence")}
                value={`${listingConfidence.score} / 100`}
                hint={listingConfidence.possiblyStale ? "möglicherweise veraltet" : undefined}
                tone={listingConfidence.possiblyStale ? "caution" : "default"}
              />
            </div>

            <Separator soft />

            <JobActions
              jobId={job.id}
              blocked={constraints.overall === "blocked"}
              initiallySaved={savedRow.length > 0}
              labels={{
                prepare: t("jobDetail.prepareApplication"),
                save: t("jobs.save"),
                saved: t("jobs.saved"),
                discuss: t("jobs.discuss"),
              }}
            />

            {job.originalUrl && (
              <a
                href={job.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 text-sm text-accent-text underline underline-offset-[3px]"
              >
                {t("common.openOriginal")}
                <ExternalLink className="size-3.5" strokeWidth={1.9} />
              </a>
            )}
          </Card>

          <NinaPanel
            jobId={job.id}
            assistantName={brand.assistantName}
            hasReviews={reviews.length > 0}
          />
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-3">
      <dt className="w-[150px] shrink-0 text-ink-3">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}

/** Fragen aus dem, was fehlt. Nicht aus einer allgemeinen Liste. */
function buildQuestions(scored: Awaited<ReturnType<typeof loadScoredJob>>): string[] {
  if (!scored) return [];
  const questions: string[] = [];
  const { job, constraints, jobQuality, aiTransition, themes } = scored;

  if (!job.salary.disclosed) {
    questions.push("In welchem Rahmen bewegt sich das Gehalt für diese Position?");
  }
  if (job.coreTasks.length === 0) {
    questions.push("Wie sieht ein typischer Arbeitstag in dieser Rolle aus?");
  }
  if (job.weeklyHours === null) {
    questions.push("Wie viele Wochenstunden sind vorgesehen, und wie flexibel sind sie?");
  }
  if (job.contractType === null) {
    questions.push("Ist die Stelle unbefristet, und gibt es eine Probezeitregelung?");
  }
  for (const c of constraints.checks.filter((c) => c.verdict === "uncertain")) {
    if (c.key === "commute") questions.push("Wie oft ist Anwesenheit vor Ort erwartet?");
    if (c.key === "travel") questions.push("Wie hoch ist der Reiseanteil tatsächlich?");
  }
  const workloadTheme = themes.find((th) => /belastung|überstunden|druck/i.test(th.theme));
  if (workloadTheme && workloadTheme.sentiment !== "positive") {
    questions.push(
      "In Bewertungen wird die Arbeitsbelastung mehrfach erwähnt. Wie sieht eine typische Woche in " +
        "einer arbeitsreichen Phase aus?",
    );
  }
  if (jobQuality.insufficientData) {
    questions.push("Wie würden Sie die Zusammenarbeit im Team und die Führungskultur beschreiben?");
  }
  if (aiTransition.category === "partly_transformable") {
    questions.push(
      "Welche Werkzeuge nutzt das Team heute schon, und wie soll sich die Rolle in den nächsten " +
        "zwei Jahren entwickeln?",
    );
  }
  if (questions.length === 0) {
    questions.push("Woran würden Sie nach sechs Monaten merken, dass die Besetzung gut war?");
  }
  return questions.slice(0, 6);
}
