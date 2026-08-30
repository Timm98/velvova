import type { Metadata } from "next";
import { plural } from "@paycheck/domain";
import type { SortKey } from "@paycheck/matching";
import Link from "next/link";
import { Suspense } from "react";
import { Compass, Filter, Link2, Sparkles, Target } from "lucide-react";
import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { listJobsForUser, loadProfileContext, type ScoredJob } from "@/lib/matching";
import { buildDecisionBrief } from "@/lib/applications/decision-brief";
import { loadGate } from "@/lib/gate";
import { Badge, Button, SkeletonText } from "@/components/ui";
import { EmptyState, PageHeader } from "@/components/ui/states";
import type { JobRowData } from "@/components/jobs/JobRow";
import { JobFilters } from "./JobFilters";
import { JobSplitView } from "./JobSplitView";
import { JobDetailPanel } from "./JobDetailPanel";

export const metadata: Metadata = { title: "Matches" };
export const dynamic = "force-dynamic";

const SORT_KEYS: SortKey[] = [
  "best_overall", "highest_fit", "best_job_quality", "highest_salary",
  "future_robust", "shortest_commute", "newest",
];

/**
 * Die Stellenliste.
 *
 * Keine endlose Ergebnisseite, sondern drei begründete Gruppen:
 *
 *   1. Beste Treffer — wenige, mit Grund und Vorbehalt.
 *   2. Mutige Alternativen — angrenzende Rollen, auf die man beim
 *      Suchen nach dem eigenen Jobtitel nie stößt. Das ist der eigentliche
 *      Grund, warum vorher ein Gespräch stattfindet.
 *   3. Neu diese Woche — was seit Kurzem dazugekommen ist.
 *
 * Ausgeschlossene Stellen erscheinen nicht in der Auswahl, sind aber auf
 * Wunsch sichtbar — mit konkretem Grund. Etwas stillschweigend
 * wegzufiltern wäre schlechter, als es zu begründen.
 */
export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const { t, brand } = await getPageContext();
  const params = await searchParams;
  const gate = await loadGate(user.id);

  // Der Riegel: ohne bestätigtes Mindestprofil keine personalisierten
  // Vorschläge. Kein Gimmick, sondern der Unterschied zwischen
  // Empfehlung und Zufall.
  if (!gate.unlocked) {
    return (
      <div className="grid gap-8">
        <PageHeader eyebrow="Matches" title="Deine besten Möglichkeiten" />
        <EmptyState
          icon={<Target className="size-5" strokeWidth={1.7} />}
          title={`${brand.assistantName} braucht noch etwas mehr von dir`}
          body={`${t("jobs.lockedBody")} ${gate.reason}`}
          action={
            <Button asChild variant="primary">
              <Link href={gate.profileConfirmed ? "/app/nina" : "/app/career"}>
                {gate.profileConfirmed ? t("jobs.lockedCta") : "Profil bestätigen"}
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const db = await getDb();
  const ctx = await loadProfileContext(user.id);
  const includeBlocked = params.blocked === "1";
  const sort = (SORT_KEYS as string[]).includes(params.sort ?? "")
    ? (params.sort as SortKey)
    : "best_overall";

  const [saved, { jobs, blockedCount, staleCount }] = await Promise.all([
    withUser(db, user.id, (tx) =>
      tx
        .select({ jobId: schema.savedJobs.jobId })
        .from(schema.savedJobs)
        .where(eq(schema.savedJobs.userId, user.id)),
    ),
    listJobsForUser(user.id, ctx, { sort, includeBlocked }),
  ]);

  const savedIds = new Set(saved.map((s) => s.jobId));
  const filtered = applyFilters(jobs, params);
  const blockedJobs = includeBlocked
    ? filtered.filter((j) => j.constraints.overall === "blocked")
    : [];
  const eligible = filtered.filter((j) => j.constraints.overall !== "blocked");

  // Drei Gruppen, überschneidungsfrei: was oben steht, steht nicht
  // unten noch einmal.
  const grouped = sort === "best_overall";
  const top = grouped ? eligible.slice(0, 8) : eligible.slice(0, 20);
  const topIds = new Set(top.map((j) => j.jobId));

  const alternatives = grouped
    ? eligible.filter((j) => !topIds.has(j.jobId) && j.fit.band === "exploratory").slice(0, 4)
    : [];
  const altIds = new Set(alternatives.map((j) => j.jobId));

  const weekAgo = Date.now() - 7 * 86_400_000;
  const fresh = grouped
    ? eligible
        .filter(
          (j) =>
            !topIds.has(j.jobId) &&
            !altIds.has(j.jobId) &&
            (j.job.publishedAt?.getTime() ?? 0) >= weekAgo,
        )
        .slice(0, 6)
    : [];

  const realCount = filtered.filter((j) => !j.job.isDemo).length;
  const demoCount = filtered.length - realCount;

  // Die Auswahl steht im Suchparameter, damit sie verlinkbar ist und der
  // Zurück-Knopf das Erwartete tut.
  const requested = params.job;
  const selected: ScoredJob | null =
    (requested ? filtered.find((j) => j.jobId === requested) : undefined) ?? filtered[0] ?? null;

  const rows: JobRowData[] = filtered.map((j) => ({
    id: j.jobId,
    title: j.job.title,
    companyName: j.job.companyName,
    location: j.job.location,
    workModel: j.job.workModel,
    contractType: CONTRACT[j.job.contractType ?? ""] ?? null,
    salaryLabel: j.job.salary.disclosed
      ? `${new Intl.NumberFormat("de-DE").format(j.job.salary.min ?? j.job.salary.max ?? 0)}${
          j.job.salary.min && j.job.salary.max
            ? `–${new Intl.NumberFormat("de-DE").format(j.job.salary.max)}`
            : ""
        } ${j.job.salary.currency}`
      : null,
    ageLabel: relativeAge(j.job.publishedAt ?? j.job.fetchedAt).label,
    isFresh: relativeAge(j.job.publishedAt ?? j.job.fetchedAt).fresh,
    sourceName: j.source?.displayName ?? "unbekannt",
    score: j.fit.score,
    band: j.fit.band,
    confidence: j.confidence.level,
    reason: j.fit.topReason,
    reservation: j.fit.topReservation,
    blocked: j.constraints.overall === "blocked",
    saved: savedIds.has(j.jobId),
  }));

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Entdecken"
        title="Deine besten Möglichkeiten"
        lead={`${brand.assistantName} hat ${plural(jobs.length + blockedCount, "Stelle", "Stellen")} gegen dein bestätigtes Profil geprüft. Sortiert nach begründeter Passung — nicht nach Werbebudget.`}
        actions={
          // Wer die Stelle woanders gefunden hat, soll sie hier
          // trotzdem prüfen lassen können. Ohne diesen Weg endet jede
          // Empfehlung an der Grenze unserer Quellen.
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {/* Der Trichter gehört hierher, nicht in die Navigation: er
                beantwortet eine Frage, die genau beim Blick auf diese
                Liste entsteht — „ist das wirklich alles?". */}
            <Link
              href="/app/opportunities"
              className="inline-flex min-h-6 items-center gap-1.5 text-sm text-accent-text underline underline-offset-[3px]"
            >
              <Filter aria-hidden className="size-3.5" strokeWidth={1.9} />
              Wie viele davon sind echte Chancen?
            </Link>
            <Link
              href="/app/jobs/import"
              className="inline-flex min-h-6 items-center gap-1.5 text-sm text-accent-text underline underline-offset-[3px]"
            >
              <Link2 aria-hidden className="size-3.5" strokeWidth={1.9} />
              Job-Link analysieren
            </Link>
          </div>
        }
      />

      <Suspense fallback={<SkeletonText lines={2} />}>
        <JobFilters resultCount={filtered.length} />
      </Suspense>

      {/* Herkunft, immer sichtbar. */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {realCount > 0 && (
          <Badge tone="positive">
            <span aria-hidden className="size-1.5 rounded-full bg-positive" />
            {realCount} echte Stellen
          </Badge>
        )}
        {demoCount > 0 && <Badge tone="caution">{demoCount} Demo-Datensätze</Badge>}
        <span className="text-ink-3">
          Echte Anzeigen stammen aus offen angebotenen Quellen und verlinken auf das Original.
        </span>
        <Link
          href="/app/settings/integrations"
          className="ml-auto inline-flex min-h-6 items-center text-sm text-accent-text underline underline-offset-[3px]"
        >
          Quellen
        </Link>
      </div>

      <JobSplitView
        rows={rows}
        selectedId={selected?.jobId ?? null}
        explicitSelection={Boolean(requested)}
        emptyState={
          <EmptyState
            icon={<Compass className="size-5" strokeWidth={1.7} />}
            title="Zu diesen Filtern gibt es nichts"
            body="Nimm einen Filter weg oder formuliere die Suche anders. Es wird nichts ausgedacht, um die Liste zu füllen."
            action={
              <Button asChild variant="secondary">
                <Link href="/app/jobs">Filter zurücksetzen</Link>
              </Button>
            }
          />
        }
        detail={
          selected ? (
            <JobDetailPanel
              scored={selected}
              t={t}
              saved={savedIds.has(selected.jobId)}
              assistantName={brand.assistantName}
              labels={{ save: t("jobs.save"), saved: t("jobs.saved") }}
              brief={buildDecisionBrief({
                scored: selected,
                // Die Jahre stehen nicht als Feld im Profil. Sie aus
                // einer Zahl abzuleiten, die es nicht gibt, wäre eine
                // Erfindung — also bleibt das Niveau unbekannt, und der
                // Abgleich sagt das auch so.
                userYearsExperience: null,
                userConstraints: {
                  maxTravelPercent: ctx.constraints.maxTravelPercent ?? null,
                  maxCommuteMinutes: ctx.constraints.maxCommuteMinutes ?? null,
                  minSalary: ctx.constraints.minSalaryPerYear ?? null,
                  noShiftWork: ctx.constraints.acceptsShiftWork === false,
                },
              })}
            />
          ) : null
        }
      />

      {staleCount > 0 && (
        <p className="text-sm leading-relaxed text-ink-3">
          {staleCount} {staleCount === 1 ? "Anzeige ist" : "Anzeigen sind"} abgelaufen oder nicht
          mehr erreichbar und {staleCount === 1 ? "steht" : "stehen"} deshalb nicht in der Liste.
          Eine Bewerbung dort würde ins Leere gehen.
        </p>
      )}

      {blockedCount > 0 && (
        <p className="text-sm leading-relaxed text-ink-3">
          {blockedCount} {blockedCount === 1 ? "Stelle verletzt" : "Stellen verletzen"} eine deiner
          harten Bedingungen und {blockedCount === 1 ? "ist" : "sind"} deshalb nicht in der Liste.{" "}
          <Link
            href={includeBlocked ? "/app/jobs" : "/app/jobs?blocked=1"}
            scroll={false}
            className="inline-flex min-h-6 items-center text-accent-text underline underline-offset-[3px]"
          >
            {includeBlocked ? "Wieder ausblenden" : "Mit Begründung anzeigen"}
          </Link>
        </p>
      )}
    </div>
  );
}

const CONTRACT: Record<string, string> = {
  permanent: "Unbefristet",
  fixed_term: "Befristet",
  internship: "Praktikum",
  working_student: "Werkstudium",
  apprenticeship: "Ausbildung",
  freelance: "Freiberuflich",
  temp_agency: "Zeitarbeit",
};

/** Alter in Worten. „vor 3 Tagen" liest sich schneller als ein Datum. */
function relativeAge(date: Date | null): { label: string | null; fresh: boolean } {
  if (!date) return { label: null, fresh: false };
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return { label: "heute", fresh: true };
  if (days === 1) return { label: "gestern", fresh: true };
  if (days < 7) return { label: `vor ${days} Tagen`, fresh: true };
  if (days < 30) return { label: `vor ${Math.floor(days / 7)} Wochen`, fresh: false };
  return { label: `vor ${Math.floor(days / 30)} Monaten`, fresh: false };
}

/**
 * Filter auf der bereits bewerteten Liste.
 *
 * Das Suchfeld nimmt normale Sprache: gesucht wird über Titel,
 * Unternehmen, Ort und Aufgaben. Bewusst keine Deutung von Absichten —
 * eine Suche, die etwas anderes tut als eingegeben, ist schlimmer als
 * eine, die zu wenig findet.
 */
function applyFilters(jobs: ScoredJob[], params: Record<string, string | undefined>): ScoredJob[] {
  let result = jobs;

  const q = params.q?.trim().toLowerCase();
  if (q) {
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    result = result.filter((j) => {
      const haystack = [
        j.job.title,
        j.job.companyName,
        j.job.location,
        j.job.industry ?? "",
        ...j.job.coreTasks,
      ]
        .join(" ")
        .toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }

  if (params.remote) result = result.filter((j) => j.job.workModel === params.remote);
  if (params.contract) result = result.filter((j) => j.job.contractType === params.contract);
  if (params.salary === "disclosed") result = result.filter((j) => j.job.salary.disclosed);

  const sinceDays = Number(params.since);
  if (Number.isFinite(sinceDays) && sinceDays > 0) {
    const cutoff = Date.now() - sinceDays * 86_400_000;
    result = result.filter((j) => (j.job.publishedAt?.getTime() ?? 0) >= cutoff);
  }

  return result;
}
