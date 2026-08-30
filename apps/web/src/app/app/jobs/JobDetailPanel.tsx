import Link from "next/link";
import { ExternalLink, HelpCircle } from "lucide-react";
import type { Translator } from "@paycheck/i18n";
import type { ScoredJob } from "@/lib/matching";
import { Badge, Button, Separator } from "@/components/ui";
import { SaveJobButton } from "./SaveJobButton";

/**
 * Die ausgewählte Stelle in der rechten Spalte.
 *
 * Vier Fragen in vier Abschnitten, in dieser Reihenfolge: Passt das zu
 * mir? Was ist die Rolle wirklich? Was verlangt sie? Woher kommt die
 * Anzeige?
 *
 * Was hier bewusst NICHT steht: die volle Stellenbeschreibung als
 * Textwand. Sie ist einen Klick entfernt — wer sie liest, hat sich
 * schon entschieden, dass die Stelle interessant ist.
 */

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

export function JobDetailPanel({
  scored,
  t,
  saved,
  assistantName,
  labels,
}: {
  scored: ScoredJob;
  t: Translator["t"];
  saved: boolean;
  assistantName: string;
  labels: { save: string; saved: string };
}) {
  const { job, fit, confidence, jobQuality, listingConfidence, constraints } = scored;
  const musts = scored.requirements.filter((r) => r.kind === "must");
  const nices = scored.requirements.filter((r) => r.kind === "nice");

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
    <article className="grid gap-7 p-5 lg:p-7">
      {/* ── Kopf ─────────────────────────────────────────── */}
      <header className="grid gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="outline">Quelle: {scored.source?.displayName ?? "unbekannt"}</Badge>
          <span className="font-mono text-2xs text-ink-3">
            abgerufen {new Intl.DateTimeFormat("de-DE").format(job.fetchedAt)}
          </span>
          {listingConfidence.possiblyStale && (
            <Badge tone="caution">{t("jobDetail.staleWarning")}</Badge>
          )}
          {job.isDemo && <Badge tone="caution">Demo-Datensatz</Badge>}
        </div>

        {/* Dieselbe Stelle auf mehreren Portalen ist eine Stelle, nicht
            drei. Wo sie sonst noch steht, gehört trotzdem dazu: manchmal
            ist der Bewerbungsweg beim einen Portal kürzer als beim
            anderen. */}
        {scored.alsoListedOn.length > 0 && (
          <p className="text-xs leading-relaxed text-ink-3">
            Diese Stelle steht auch bei{" "}
            {scored.alsoListedOn.map((eintrag, i) => (
              <span key={eintrag.url}>
                {i > 0 && (i === scored.alsoListedOn.length - 1 ? " und " : ", ")}
                <a
                  href={eintrag.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex min-h-6 items-center text-accent-text underline underline-offset-[3px]"
                >
                  {eintrag.sourceName}
                </a>
              </span>
            ))}
            . Zusammengefasst über Titel, Unternehmen und Ort.
          </p>
        )}

        <h2 className="font-display text-[1.75rem] font-semibold leading-[1.12] tracking-[-0.025em]">
          {job.title}
        </h2>

        <p className="text-sm text-ink-2">
          {job.companyName} · {job.location} · {WORK_MODEL[job.workModel] ?? job.workModel}
          {job.contractType ? ` · ${CONTRACT[job.contractType] ?? job.contractType}` : ""}
        </p>

        <p>
          {job.salary.disclosed ? (
            <span className="font-mono text-lg font-semibold tabular">
              {money(job.salary.min ?? job.salary.max ?? 0)}
              {job.salary.max && job.salary.min && job.salary.max !== job.salary.min
                ? ` – ${money(job.salary.max)}`
                : ""}
              <span className="ml-1.5 font-sans text-sm font-normal text-ink-3">pro Jahr</span>
            </span>
          ) : (
            <span className="text-sm text-ink-3">
              Gehalt nicht angegeben — das ist keine schlechte Angabe, sondern gar keine.
            </span>
          )}
        </p>

        <div className="flex flex-wrap gap-2.5">
          <Button asChild variant="primary" size="sm">
            <Link href={`/app/jobs/${job.id}`}>Vollständige Analyse</Link>
          </Button>
          <SaveJobButton
            jobId={job.id}
            initiallySaved={saved}
            labels={{ save: labels.save, saved: labels.saved }}
          />
          {job.originalUrl && (
            <Button asChild variant="ghost" size="sm">
              <a href={job.originalUrl} target="_blank" rel="noopener noreferrer">
                Original
                <ExternalLink className="size-3.5" strokeWidth={1.8} />
              </a>
            </Button>
          )}
        </div>
      </header>

      <Separator soft />

      {/* ── Passung ──────────────────────────────────────── */}
      <section aria-labelledby="passung" className="grid gap-4">
        <div className="flex items-end justify-between gap-6">
          <div>
            <h3 id="passung" className="font-mono text-2xs uppercase tracking-wider text-ink-3">
              {t("jobs.fit")}
            </h3>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-[2.25rem] font-semibold leading-none tabular">
                {fit.score ?? "–"}
              </span>
              <span className="text-sm text-ink-2">{bandText}</span>
            </p>
          </div>
          <div className="text-right">
            <h3 className="font-mono text-2xs uppercase tracking-wider text-ink-3">
              {t("jobs.confidence")}
            </h3>
            <p className="mt-2 flex items-center justify-end gap-2 text-sm text-ink-2">
              <span aria-hidden className="flex gap-[3px]">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={
                      i < (confidence.level === "high" ? 3 : confidence.level === "medium" ? 2 : 1)
                        ? confidence.level === "high"
                          ? "h-1.5 w-4 rounded-full bg-positive"
                          : confidence.level === "medium"
                            ? "h-1.5 w-4 rounded-full bg-caution"
                            : "h-1.5 w-4 rounded-full bg-critical"
                        : "h-1.5 w-4 rounded-full bg-inset"
                    }
                  />
                ))}
              </span>
              {confidence.level === "high" ? "hoch" : confidence.level === "medium" ? "mittel" : "niedrig"}
            </p>
          </div>
        </div>

        {/* Die Aufschlüsselung. Bekannte Faktoren mit Balken, unbekannte
            ausdrücklich als unbekannt — nicht weggelassen. */}
        <ul className="grid gap-3">
          {fit.factors
            .filter((f) => f.raw !== null)
            .map((f) => (
              <li key={f.key} className="grid gap-1.5">
                <span className="flex items-baseline justify-between gap-3 text-sm">
                  {f.label}
                  <span className="font-mono text-xs text-ink-3 tabular">
                    {Math.round((f.raw ?? 0) * 100)}
                  </span>
                </span>
                <span aria-hidden className="h-1 overflow-hidden rounded-full bg-inset">
                  <span
                    className="signal-gradient block h-full rounded-full"
                    style={{ width: `${Math.round((f.raw ?? 0) * 100)}%` }}
                  />
                </span>
              </li>
            ))}
        </ul>

        <div className="grid gap-2 rounded-[--radius-md] bg-inset px-4 py-3.5 text-sm leading-relaxed">
          <p>
            <span className="font-medium text-positive">Dafür spricht: </span>
            <span className="text-ink-2">{fit.topReason}</span>
          </p>
          <p>
            <span className="font-medium text-caution">Zu prüfen: </span>
            <span className="text-ink-2">{fit.topReservation}</span>
          </p>
          {confidence.reducedBy.length > 0 && (
            <p className="text-ink-3">
              Sicherheit gemindert durch: {confidence.reducedBy.join(" ")}
            </p>
          )}
        </div>

        {constraints.overall === "blocked" && (
          <div
            role="note"
            className="grid gap-2 rounded-[--radius-md] border border-critical/30 bg-critical-soft px-4 py-3.5"
          >
            <p className="text-sm font-medium text-critical">{t("jobs.blockedBecause")}</p>
            <ul className="grid gap-1.5">
              {constraints.checks
                .filter((c) => c.verdict === "blocked")
                .map((c) => (
                  <li key={c.key} className="text-sm leading-relaxed">
                    <span className="font-medium">{c.label}: </span>
                    <span className="text-ink-2">{c.reason}</span>
                  </li>
                ))}
            </ul>
            <p className="text-xs leading-relaxed text-ink-3">
              Eine harte Bedingung wird nicht gegen weiche Stärken aufgerechnet. Bewerben kannst du
              dich trotzdem — die Entscheidung liegt bei dir.
            </p>
          </div>
        )}
      </section>

      <Separator soft />

      {/* ── Die Rolle ────────────────────────────────────── */}
      <section aria-labelledby="rolle" className="grid gap-3.5">
        <h3 id="rolle" className="font-mono text-2xs uppercase tracking-wider text-ink-3">
          Der Arbeitsalltag
        </h3>
        {job.coreTasks.length > 0 ? (
          <ul className="grid gap-2">
            {job.coreTasks.slice(0, 6).map((task) => (
              <li key={task} className="flex gap-2.5 text-sm leading-relaxed text-ink-2">
                <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-ink-3" />
                {task}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm leading-relaxed text-ink-3">
            Die Anzeige beschreibt keine konkreten Aufgaben. Das ist der wichtigste Punkt für das
            Erstgespräch — ohne Aufgaben lässt sich weder Passung noch Entwicklung einschätzen.
          </p>
        )}
      </section>

      {/* ── Anforderungen ────────────────────────────────── */}
      <section aria-labelledby="anforderungen" className="grid gap-3.5">
        <h3 id="anforderungen" className="font-mono text-2xs uppercase tracking-wider text-ink-3">
          Anforderungen
        </h3>
        {musts.length === 0 && nices.length === 0 ? (
          <p className="text-sm text-ink-3">Die Anzeige nennt keine ausdrücklichen Anforderungen.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium">{t("jobDetail.mustHave")}</p>
              <ul className="mt-2 grid gap-1.5">
                {musts.slice(0, 5).map((r) => (
                  <li key={r.id} className="text-sm leading-relaxed text-ink-2">
                    {r.text}
                  </li>
                ))}
                {musts.length === 0 && <li className="text-sm text-ink-3">Keine genannt.</li>}
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium">{t("jobDetail.niceToHave")}</p>
              <ul className="mt-2 grid gap-1.5">
                {nices.slice(0, 5).map((r) => (
                  <li key={r.id} className="text-sm leading-relaxed text-ink-2">
                    {r.text}
                  </li>
                ))}
                {nices.length === 0 && <li className="text-sm text-ink-3">Keine genannt.</li>}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* ── Jobqualität, knapp ───────────────────────────── */}
      <section aria-labelledby="qualitaet" className="grid gap-2">
        <h3 id="qualitaet" className="font-mono text-2xs uppercase tracking-wider text-ink-3">
          {t("jobs.jobQuality")}
        </h3>
        <p className="text-sm leading-relaxed text-ink-2">
          {jobQuality.insufficientData
            ? "Nicht ausreichend beurteilbar. Das ist ausdrücklich kein schlechtes Ergebnis — es liegen zu wenige belastbare Angaben vor."
            : `${jobQuality.score} von 100, aus ${jobQuality.dimensions.filter((d) => d.raw !== null).length} bewertbaren Dimensionen.`}
        </p>
      </section>

      <Separator soft />

      {/* ── Nina ─────────────────────────────────────────── */}
      <section aria-labelledby="nina-fragen" className="grid gap-2.5">
        <h3 id="nina-fragen" className="font-mono text-2xs uppercase tracking-wider text-ink-3">
          {assistantName} zu dieser Stelle
        </h3>
        <ul className="grid gap-1.5">
          {[
            { key: "day", label: "Erklär mir den echten Arbeitsalltag" },
            { key: "gap", label: "Welche Anforderungen fehlen mir?" },
            { key: "flags", label: "Welche Warnsignale siehst du?" },
            { key: "questions", label: "Welche Fragen soll ich im Gespräch stellen?" },
          ].map((prompt) => (
            <li key={prompt.key}>
              <Link
                href={`/app/nina?job=${job.id}&ask=${prompt.key}`}
                className="flex items-center gap-2.5 rounded-[--radius-md] border border-line-2 px-3.5 py-2.5 text-sm transition-colors hover:border-line-3 hover:bg-inset/60"
              >
                <HelpCircle className="size-3.5 shrink-0 text-ink-3" strokeWidth={1.8} />
                {prompt.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
