import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { loadScoredJob } from "@/lib/matching";
import { coverLetterAdvisable } from "@paycheck/documents";
import { Badge, buttonStyle, Card, Disclosure, PageHeader, SourceNote, Stack } from "@/components/ui";
import {
  AiTransitionDisplay,
  BlockedNotice,
  ConfidenceDisplay,
  FactorBreakdown,
  FitDisplay,
  JobQualityDisplay,
  ListingConfidenceDisplay,
} from "@/components/scores";
import { JobActions } from "./JobActions";
import { ViewTracker } from "./ViewTracker";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
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

/**
 * Job Intelligence.
 *
 * Diese Seite ist ausdrücklich keine kopierte Stellenanzeige. Sie
 * beantwortet vier Fragen, die eine Anzeige nicht beantwortet: passt das
 * zu mir und wie sicher ist das, wie gut ist die Stelle als Arbeitsplatz,
 * wie verändern sich die Aufgaben, und wie vertrauenswürdig ist die
 * Anzeige selbst.
 */
export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const { t, brand } = await getPageContext();

  const scored = await loadScoredJob(user.id, id);
  if (!scored) notFound();

  const { job, fit, confidence, jobQuality, aiTransition, listingConfidence, constraints, requirements, reviews, themes, source } = scored;
  const musts = requirements.filter((r) => r.kind === "must");
  const nices = requirements.filter((r) => r.kind === "nice");
  const coverLetter = coverLetterAdvisable(job);

  const employeeReviews = reviews.filter((r) => r.sourceKind === "employee_reviews");
  const otherReviews = reviews.filter((r) => r.sourceKind !== "employee_reviews");

  return (
    <Stack gap={7}>
      <ViewTracker jobId={job.id} />

      {/* --- Kopf --- */}
      <header style={{ display: "grid", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
          {job.isDemo && <Badge tone="caution">Demo-Datensatz</Badge>}
          {listingConfidence.possiblyStale && <Badge tone="caution">{t("jobDetail.staleWarning")}</Badge>}
        </div>

        <PageHeader title={job.title} />

        <p style={{ color: "var(--text-secondary)" }}>
          {job.companyName} · {job.location} ·{" "}
          {job.workModel === "remote" ? "remote" : job.workModel === "hybrid" ? "hybrid" : "vor Ort"}
          {job.remotePercent !== null && ` (${job.remotePercent} % remote)`}
          {job.contractType && ` · ${job.contractType === "permanent" ? "unbefristet" : job.contractType}`}
        </p>

        <p style={{ fontSize: "var(--text-lg)" }}>
          {job.salary.disclosed ? (
            <strong>
              {new Intl.NumberFormat("de-DE", { style: "currency", currency: job.salary.currency, maximumFractionDigits: 0 }).format(job.salary.min ?? job.salary.max ?? 0)}
              {job.salary.max && job.salary.min && job.salary.max !== job.salary.min
                ? ` – ${new Intl.NumberFormat("de-DE", { style: "currency", currency: job.salary.currency, maximumFractionDigits: 0 }).format(job.salary.max)}`
                : ""}
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 400, color: "var(--text-muted)" }}> pro Jahr</span>
            </strong>
          ) : (
            <span style={{ color: "var(--text-muted)" }}>
              Gehalt nicht angegeben — das ist keine schlechte Angabe, sondern gar keine.
            </span>
          )}
        </p>
      </header>

      <BlockedNotice constraints={constraints} t={t} />

      {/* --- Warum Nina das zeigt --- */}
      <Card style={{ background: "var(--assistant-subtle)", borderColor: "var(--assistant-border)" }}>
        <Stack gap={4}>
          <Badge tone="assistant">{t("jobDetail.whyShown")}</Badge>
          <p style={{ maxWidth: "var(--measure)" }}>{fit.topReason}</p>
          <p style={{ maxWidth: "var(--measure)", color: "var(--text-secondary)" }}>
            <strong>Was dagegen spricht: </strong>
            {fit.topReservation}
          </p>
        </Stack>
      </Card>

      {/* --- Die fünf Bewertungen, getrennt --- */}
      <Card>
        <div className="scroll-x" style={{ display: "flex", gap: "var(--space-7)", paddingBottom: 4 }}>
          <FitDisplay fit={fit} t={t} />
          <ConfidenceDisplay confidence={confidence} t={t} />
          <JobQualityDisplay quality={jobQuality} t={t} />
          <AiTransitionDisplay ai={aiTransition} t={t} />
          <ListingConfidenceDisplay listing={listingConfidence} t={t} />
        </div>
        {confidence.reducedBy.length > 0 && (
          <p style={{ marginTop: "var(--space-4)", fontSize: "var(--text-sm)", color: "var(--text-secondary)", borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-3)" }}>
            <strong>Warum die Sicherheit nicht höher ist: </strong>
            {confidence.reducedBy.join(" ")}
          </p>
        )}
      </Card>

      <JobActions
        jobId={job.id}
        blocked={constraints.overall === "blocked"}
        labels={{
          prepare: t("jobDetail.prepareApplication"),
          save: t("jobs.save"),
          saved: t("jobs.saved"),
          discuss: t("jobs.discuss"),
        }}
      />

      {/* --- Überblick --- */}
      <section aria-labelledby="überblick">
        <h2 id="überblick" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>
          {t("jobDetail.tabOverview")}
        </h2>

        <Stack gap={5}>
          {job.coreTasks.length > 0 ? (
            <Card>
              <Stack gap={3}>
                <h3 style={{ fontSize: "var(--text-base)" }}>{t("jobDetail.coreTasks")}</h3>
                <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)" }}>
                  {job.coreTasks.map((task) => (
                    <li key={task} style={{ fontSize: "var(--text-sm)", display: "flex", gap: "var(--space-2)" }}>
                      <span aria-hidden style={{ color: "var(--text-muted)" }}>·</span>
                      {task}
                    </li>
                  ))}
                </ul>
              </Stack>
            </Card>
          ) : (
            <Card style={{ background: "var(--surface-sunken)", boxShadow: "none" }}>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                Die Anzeige beschreibt keine konkreten Aufgaben. Das ist der wichtigste Punkt,
                den du im Erstgespräch klären solltest — ohne Aufgaben lässt sich weder Passung
                noch Entwicklung einschätzen.
              </p>
            </Card>
          )}

          <Disclosure summary="Vollständige Stellenbeschreibung">
            <p style={{ whiteSpace: "pre-wrap", fontSize: "var(--text-sm)", lineHeight: 1.7, color: "var(--text-secondary)" }}>
              {job.description}
            </p>
          </Disclosure>
        </Stack>
      </section>

      {/* --- Dein Match --- */}
      <section aria-labelledby="match">
        <h2 id="match" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>
          {t("jobDetail.tabMatch")}
        </h2>

        <Stack gap={5}>
          <div style={{ display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))" }}>
            <Card>
              <Stack gap={3}>
                <h3 style={{ fontSize: "var(--text-base)" }}>{t("jobDetail.mustHave")}</h3>
                {musts.length === 0 ? (
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                    Die Anzeige nennt keine zwingenden Anforderungen.
                  </p>
                ) : (
                  <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)" }}>
                    {musts.map((r) => (
                      <li key={r.id} style={{ fontSize: "var(--text-sm)" }}>
                        {r.text}
                      </li>
                    ))}
                  </ul>
                )}
              </Stack>
            </Card>

            <Card>
              <Stack gap={3}>
                <h3 style={{ fontSize: "var(--text-base)" }}>{t("jobDetail.niceToHave")}</h3>
                {nices.length === 0 ? (
                  <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Keine genannt.</p>
                ) : (
                  <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)" }}>
                    {nices.map((r) => (
                      <li key={r.id} style={{ fontSize: "var(--text-sm)" }}>
                        {r.text}
                      </li>
                    ))}
                  </ul>
                )}
              </Stack>
            </Card>
          </div>

          <Card>
            <FactorBreakdown factors={fit.factors} title="Woraus die Passung entsteht" />
          </Card>

          {/* Harte Bedingungen einzeln */}
          <Card>
            <Stack gap={4}>
              <h3 style={{ fontSize: "var(--text-base)" }}>Deine Bedingungen, einzeln geprüft</h3>
              <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-3)" }}>
                {constraints.checks.map((c) => (
                  <li key={c.key} style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
                    <span style={{ minWidth: 90 }}>
                      <Badge
                        tone={c.verdict === "eligible" ? "positive" : c.verdict === "blocked" ? "critical" : "neutral"}
                      >
                        {c.verdict === "eligible" ? "erfüllt" : c.verdict === "blocked" ? "verletzt" : "unbekannt"}
                      </Badge>
                    </span>
                    <span style={{ fontSize: "var(--text-sm)" }}>
                      <strong>{c.label}:</strong> {c.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </Stack>
          </Card>
        </Stack>
      </section>

      {/* --- Jobqualität --- */}
      <section aria-labelledby="qualität">
        <h2 id="qualität" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>
          {t("jobDetail.tabQuality")}
        </h2>
        <Card>
          {jobQuality.insufficientData ? (
            <Stack gap={3}>
              <p style={{ color: "var(--text-secondary)", maxWidth: "var(--measure)" }}>
                Die Jobqualität lässt sich hier nicht ausreichend beurteilen. Das ist ausdrücklich
                <strong> kein schlechtes Ergebnis</strong> — es liegen schlicht zu wenige belastbare
                Angaben vor.
              </p>
              <FactorBreakdown factors={jobQuality.dimensions} title="Was bekannt ist und was fehlt" />
            </Stack>
          ) : (
            <FactorBreakdown factors={jobQuality.dimensions} title="Die sechs Dimensionen" />
          )}
        </Card>
      </section>

      {/* --- Zukunft und KI --- */}
      <section aria-labelledby="zukunft">
        <h2 id="zukunft" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>
          {t("jobDetail.tabFuture")}
        </h2>

        <Stack gap={4}>
          <Card>
            <Stack gap={4}>
              <p style={{ color: "var(--text-secondary)", maxWidth: "var(--measure)" }}>
                Bewertet werden die Aufgaben dieser Rolle, nicht der Berufstitel. Ob sich etwas
                ändert, hängt daran, woraus die Arbeit tatsächlich besteht — nicht daran, wie
                sie heisst.{" "}
                {aiTransition.dataAsOf
                  ? `Datenstand: ${new Intl.DateTimeFormat("de-DE").format(aiTransition.dataAsOf)}.`
                  : "Zur zugrunde liegenden Marktlage liegen uns keine datierten Quellen vor."}
              </p>

              {aiTransition.tasks.length === 0 ? (
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                  Ohne beschriebene Aufgaben ist keine Aussage möglich.
                </p>
              ) : (
                <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-4)" }}>
                  {aiTransition.tasks.map((task) => (
                    <li key={task.task} style={{ display: "grid", gap: "var(--space-2)" }}>
                      <strong style={{ fontSize: "var(--text-sm)" }}>{task.task}</strong>
                      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                        {task.likelyChange}
                      </p>
                      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                        Menschlicher Kern: {task.humanCore}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Stack>
          </Card>

          {aiTransition.scenarios.length > 0 && (
            <div style={{ display: "grid", gap: "var(--space-4)", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
              {aiTransition.scenarios.map((s) => (
                <Card key={s.title}>
                  <Stack gap={2}>
                    <h3 style={{ fontSize: "var(--text-base)" }}>{s.title}</h3>
                    <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>{s.description}</p>
                  </Stack>
                </Card>
              ))}
            </div>
          )}

          {aiTransition.complementarySkills.length > 0 && (
            <Card>
              <Stack gap={3}>
                <h3 style={{ fontSize: "var(--text-base)" }}>Was diese Rolle robuster macht</h3>
                <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)" }}>
                  {aiTransition.complementarySkills.map((s) => (
                    <li key={s} style={{ fontSize: "var(--text-sm)" }}>
                      · {s}
                    </li>
                  ))}
                </ul>
              </Stack>
            </Card>
          )}
        </Stack>
      </section>

      {/* --- Unternehmen und Erfahrungen --- */}
      <section aria-labelledby="unternehmen">
        <h2 id="unternehmen" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-2)" }}>
          {t("jobDetail.tabCompany")}
        </h2>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", marginBottom: "var(--space-4)", maxWidth: "var(--measure)" }}>
          Die Quellenarten bleiben getrennt. Eine Standortbewertung von Kundinnen und Kunden sagt
          nichts darüber aus, wie es sich dort arbeitet.
        </p>

        {reviews.length === 0 ? (
          <Card style={{ background: "var(--surface-sunken)", boxShadow: "none" }}>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              Zu diesem Unternehmen liegen keine externen Informationen vor. Das senkt die
              Sicherheit der Einschätzung, sagt aber nichts über das Unternehmen aus.
            </p>
          </Card>
        ) : (
          <Stack gap={5}>
            {[...employeeReviews, ...otherReviews].map((r) => {
              const relevantThemes = themes.filter((th) => th.aggregateId === r.id);
              const smallSample = (r.sampleSize ?? 0) > 0 && (r.sampleSize ?? 0) < 15;

              return (
                <Card key={r.id}>
                  <Stack gap={4}>
                    <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
                      <Badge tone={r.sourceKind === "employee_reviews" ? "assistant" : "neutral"}>
                        {SOURCE_KIND_LABEL[r.sourceKind] ?? r.sourceKind}
                      </Badge>
                      {r.isDemo && <Badge tone="caution">Demo</Badge>}
                      {r.ratingAverage !== null && (
                        <strong style={{ fontSize: "var(--text-lg)" }}>
                          {r.ratingAverage.toFixed(1)}
                          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", fontWeight: 400 }}>
                            {" "}
                            / {r.ratingScaleMax}
                          </span>
                        </strong>
                      )}
                    </div>

                    {r.sourceKind === "customer_reviews" && (
                      <p style={{ fontSize: "var(--text-sm)", color: "var(--caution)", background: "var(--caution-subtle)", padding: "var(--space-3)", borderRadius: "var(--radius-md)" }}>
                        Das sind Kundenurteile über den Standort oder das Produkt. Sie sagen nichts
                        über Arbeitsbedingungen und dürfen dafür nicht herangezogen werden.
                      </p>
                    )}

                    {smallSample && (
                      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                        {t("jobDetail.smallSample")}
                      </p>
                    )}

                    {relevantThemes.length > 0 && (
                      <div>
                        <h4 style={{ fontSize: "var(--text-sm)", marginBottom: "var(--space-3)", display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                          Wiederkehrende Themen
                          <Badge tone="assistant">{t("jobDetail.aiSummary")}</Badge>
                        </h4>
                        <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-3)" }}>
                          {relevantThemes.map((th) => (
                            <li key={th.id} style={{ fontSize: "var(--text-sm)" }}>
                              <span
                                style={{
                                  color:
                                    th.sentiment === "positive"
                                      ? "var(--positive)"
                                      : th.sentiment === "negative"
                                        ? "var(--critical)"
                                        : "var(--caution)",
                                  fontWeight: 500,
                                }}
                              >
                                {th.theme}
                              </span>
                              <span style={{ color: "var(--text-muted)" }}> ({th.mentionCount} Nennungen)</span>
                              <br />
                              <span style={{ color: "var(--text-secondary)" }}>{th.summary}</span>
                            </li>
                          ))}
                        </ul>
                        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginTop: "var(--space-3)" }}>
                          {t("jobDetail.aiSummaryNote")}
                        </p>
                      </div>
                    )}

                    {r.selectionNote && (
                      <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
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
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        )}
      </section>

      {/* --- Fragen für das Gespräch --- */}
      <section aria-labelledby="fragen">
        <h2 id="fragen" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>
          {t("jobDetail.questionsToAsk")}
        </h2>
        <Card>
          <Stack gap={3}>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              Diese Fragen leiten sich aus dem ab, was in der Anzeige fehlt oder unklar bleibt.
            </p>
            <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-3)" }}>
              {buildQuestions(scored).map((q) => (
                <li key={q} style={{ fontSize: "var(--text-sm)", display: "flex", gap: "var(--space-2)" }}>
                  <span aria-hidden style={{ color: "var(--accent)" }}>?</span>
                  {q}
                </li>
              ))}
            </ul>
          </Stack>
        </Card>
      </section>

      {/* --- Quellen --- */}
      <section aria-labelledby="quellen">
        <h2 id="quellen" style={{ fontSize: "var(--text-xl)", marginBottom: "var(--space-4)" }}>
          {t("jobDetail.tabSource")}
        </h2>
        <Card>
          <Stack gap={4}>
            <dl style={{ display: "grid", gap: "var(--space-3)", fontSize: "var(--text-sm)", margin: 0 }}>
              <Row label="Quelle" value={source?.displayName ?? "unbekannt"} />
              <Row label="Lizenzstatus" value={source?.licenseStatus ?? "unklar"} />
              <Row
                label="Veröffentlicht"
                value={job.publishedAt ? new Intl.DateTimeFormat("de-DE").format(job.publishedAt) : "nicht angegeben"}
              />
              <Row label="Zuletzt abgerufen" value={new Intl.DateTimeFormat("de-DE").format(job.fetchedAt)} />
              <Row
                label="Letzter Linkcheck"
                value={
                  job.lastLinkCheckAt
                    ? `${new Intl.DateTimeFormat("de-DE").format(job.lastLinkCheckAt)} — ${job.lastLinkCheckOk ? "erreichbar" : "nicht erreichbar"}`
                    : "noch nicht geprüft"
                }
              />
            </dl>

            <div>
              <h3 style={{ fontSize: "var(--text-base)", marginBottom: "var(--space-3)" }}>
                Woraus sich das Vertrauen in die Anzeige ergibt
              </h3>
              <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-2)" }}>
                {listingConfidence.signals.map((s) => (
                  <li key={s.key} style={{ fontSize: "var(--text-sm)", display: "flex", gap: "var(--space-2)" }}>
                    <span aria-hidden style={{ color: s.ok === true ? "var(--positive)" : s.ok === false ? "var(--critical)" : "var(--text-muted)" }}>
                      {s.ok === true ? "✓" : s.ok === false ? "✕" : "?"}
                    </span>
                    <span>
                      <strong>{s.label}:</strong> {s.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {job.originalUrl && (
              <p>
                <a href={job.originalUrl} target="_blank" rel="noopener noreferrer" style={buttonStyle("secondary")}>
                  {t("common.openOriginal")}
                </a>
              </p>
            )}
          </Stack>
        </Card>
      </section>

      <p style={{ fontSize: "var(--text-sm)" }}>
        <Link href="/app/jobs" style={{ color: "var(--accent-text)" }}>
          ← Zurück zur Auswahl
        </Link>
        {" · "}
        <span style={{ color: "var(--text-muted)" }}>
          {coverLetter.advisable
            ? "Diese Stelle verlangt ein Anschreiben."
            : `Anschreiben: ${coverLetter.reason}`}
        </span>
        {" · "}
        <span style={{ color: "var(--text-muted)" }}>
          Alle Werte stammen aus Bewertungsfassung {fit.version} von {brand.name}.
        </span>
      </p>
    </Stack>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
      <dt style={{ color: "var(--text-muted)", minWidth: 160 }}>{label}</dt>
      <dd style={{ margin: 0 }}>{value}</dd>
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
  const workloadTheme = themes.find((t) => /belastung|überstunden|druck/i.test(t.theme));
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
