import Link from "next/link";
import { AlertTriangle, Building2, Check, Clock, MapPin, Sparkles } from "lucide-react";
import type { Translator } from "@paycheck/i18n";
import type { ScoredJob } from "@/lib/matching";
import { Badge } from "@/components/ui/badge";
import { ConfidenceMeter, ScoreRing } from "@/components/ui/score";
import { cn } from "@/lib/cn";

/**
 * Eine Stelle in der Liste.
 *
 * Die Karte muss für eine Entscheidung reichen und darf trotzdem nicht
 * zur Wand werden. Deshalb genau sieben Angaben: Titel, Unternehmen,
 * Ort, Vertrag, Gehalt (nur wenn genannt), Alter, Quelle — plus Passung,
 * Sicherheit, ein Grund und ein Vorbehalt.
 *
 * Was fehlt, steht als "nicht angegeben" da und wird nirgends geschätzt.
 * Ein geratenes Gehalt in einer Karte ist eine Lüge mit Zahlenformat.
 */

function relativeDays(date: Date | null): { label: string; fresh: boolean } | null {
  if (!date) return null;
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return { label: "heute", fresh: true };
  if (days === 1) return { label: "gestern", fresh: true };
  if (days < 7) return { label: `vor ${days} Tagen`, fresh: true };
  if (days < 30) return { label: `vor ${Math.floor(days / 7)} Wochen`, fresh: false };
  return { label: `vor ${Math.floor(days / 30)} Monaten`, fresh: false };
}

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

/** Initialen statt eines erfundenen Logos. */
function CompanyMark({ name }: { name: string }) {
  const initials = name
    .replace(/\b(GmbH|AG|SE|eG|gGmbH|KG|mbH|Ltd|Inc)\b/gi, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden
      className="grid size-10 shrink-0 place-items-center rounded-[--radius-md] border border-line bg-sunken text-sm font-semibold text-ink-2"
    >
      {initials || <Building2 className="size-4" strokeWidth={1.8} />}
    </span>
  );
}

export function JobCard({
  scored,
  t,
  saved,
  action,
}: {
  scored: ScoredJob;
  t: Translator["t"];
  saved?: boolean;
  action?: React.ReactNode;
}) {
  const { job, fit, confidence } = scored;
  const age = relativeDays(job.publishedAt ?? job.fetchedAt);
  const blocked = scored.constraints.overall === "blocked";

  const bandText =
    fit.band === "high"
      ? t("jobs.fitHigh")
      : fit.band === "medium"
        ? t("jobs.fitMedium")
        : fit.band === "exploratory"
          ? t("jobs.fitExploratory")
          : t("jobs.fitInsufficient");

  const salary = job.salary.disclosed
    ? `${new Intl.NumberFormat("de-DE").format(job.salary.min ?? job.salary.max ?? 0)}${
        job.salary.min && job.salary.max
          ? `–${new Intl.NumberFormat("de-DE").format(job.salary.max)}`
          : ""
      } ${job.salary.currency}`
    : null;

  return (
    <article
      className={cn(
        "group relative rounded-[--radius-lg] border bg-raised shadow-sm transition-[box-shadow,border-color,transform] duration-[--duration-base] ease-[--ease-out]",
        "hover:-translate-y-0.5 hover:border-line-2 hover:shadow-lg",
        blocked ? "border-critical/25" : "border-line",
      )}
    >
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3.5">
            <CompanyMark name={job.companyName} />

            <div className="min-w-0 flex-1">
              <h3 className="text-[17px] font-semibold leading-snug">
                {/* Die ganze Karte ist klickbar, ohne dass die Karte
                    selbst ein Link wird — sonst wären die Knöpfe darin
                    verschachtelte Klickziele. */}
                <Link
                  href={`/app/jobs/${scored.jobId}`}
                  className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
                >
                  {job.title}
                </Link>
              </h3>
              <p className="mt-1 truncate text-sm text-ink-2">{job.companyName}</p>
            </div>
          </div>

          <ul className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-3">
            <li className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" strokeWidth={1.8} />
              {job.location}
              <span className="text-ink-3">· {WORK_MODEL[job.workModel] ?? job.workModel}</span>
            </li>
            {job.contractType && <li>{CONTRACT[job.contractType] ?? job.contractType}</li>}
            <li className={salary ? "" : "italic"}>{salary ?? "Gehalt nicht angegeben"}</li>
            {age && (
              <li className="flex items-center gap-1.5">
                <Clock className="size-3.5 shrink-0" strokeWidth={1.8} />
                {age.label}
              </li>
            )}
          </ul>

          <div className="mt-4 grid gap-2 border-t border-line pt-4 text-sm leading-relaxed">
            <p className="flex gap-2">
              <Check className="mt-[3px] size-3.5 shrink-0 text-positive" strokeWidth={2.4} />
              <span className="text-ink-2">
                <span className="font-medium text-ink">Dafür spricht: </span>
                {fit.topReason}
              </span>
            </p>
            <p className="flex gap-2">
              <AlertTriangle className="mt-[3px] size-3.5 shrink-0 text-caution" strokeWidth={2} />
              <span className="text-ink-2">
                <span className="font-medium text-ink">Zu prüfen: </span>
                {fit.topReservation}
              </span>
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {job.isDemo ? (
              <Badge tone="caution">Demo-Datensatz</Badge>
            ) : (
              <Badge tone="outline">
                Quelle: {scored.source?.displayName ?? "unbekannt"}
              </Badge>
            )}
            {age?.fresh && !job.isDemo && <Badge tone="positive">neu</Badge>}
            {saved && <Badge tone="assistant">gemerkt</Badge>}
            {blocked && <Badge tone="critical">Ausschlusskriterium</Badge>}
            {scored.listingConfidence.possiblyStale && (
              <Badge tone="caution">möglicherweise veraltet</Badge>
            )}
          </div>
        </div>

        {/* Die Bewertung rechts, deutlich abgesetzt. */}
        <div className="flex shrink-0 flex-row items-start gap-6 border-line sm:w-[180px] sm:flex-col sm:gap-5 sm:border-l sm:pl-6">
          <ScoreRing value={fit.score} label={t("jobs.fit")} band={bandText} />
          <ConfidenceMeter level={confidence.level} label={t("jobs.confidence")} />
          {action && <div className="relative z-10 sm:mt-auto">{action}</div>}
        </div>
      </div>
    </article>
  );
}

/** Ein Hinweis, warum diese Gruppe überhaupt gezeigt wird. */
export function GroupNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm leading-relaxed text-ink-2">
      <Sparkles className="mt-[3px] size-3.5 shrink-0 text-assistant" strokeWidth={2} />
      <span>{children}</span>
    </p>
  );
}
