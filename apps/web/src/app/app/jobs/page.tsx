import type { Metadata } from "next";
import type { SortKey } from "@paycheck/matching";
import Link from "next/link";
import { Suspense } from "react";
import { Compass, Sparkles, Target } from "lucide-react";
import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { listJobsForUser, loadProfileContext, type ScoredJob } from "@/lib/matching";
import { loadGate } from "@/lib/gate";
import { Badge, Button, Card, SkeletonText } from "@/components/ui";
import { EmptyState, PageHeader, Section } from "@/components/ui/states";
import { GroupNote, JobCard } from "@/components/jobs/JobCard";
import { JobFilters } from "./JobFilters";
import { SaveJobButton } from "./SaveJobButton";

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
              <Link href={gate.profileConfirmed ? "/app/nina" : "/app/profile"}>
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

  const [saved, { jobs, blockedCount }] = await Promise.all([
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

  return (
    <div className="grid gap-9">
      <PageHeader
        eyebrow="Matches"
        title="Deine besten Möglichkeiten"
        lead={`${brand.assistantName} hat ${jobs.length + blockedCount} Stellen gegen dein bestätigtes Profil geprüft. Sortiert nach begründeter Passung — nicht nach Werbebudget.`}
      />

      <Suspense fallback={<SkeletonText lines={2} />}>
        <JobFilters resultCount={filtered.length} />
      </Suspense>

      {/* Herkunft, immer sichtbar. */}
      <div className="flex flex-wrap items-center gap-3 rounded-[--radius-md] border border-line bg-sunken px-4 py-3 text-sm">
        {realCount > 0 && (
          <Badge tone="positive">
            <span aria-hidden className="size-1.5 rounded-full bg-positive" />
            {realCount} echte Stellen
          </Badge>
        )}
        {demoCount > 0 && <Badge tone="caution">{demoCount} Demo-Datensätze</Badge>}
        <span className="text-ink-2">
          Echte Anzeigen stammen aus offen angebotenen Quellen und verlinken auf das Original.
        </span>
        <Link
          href="/app/settings/integrations"
          className="ml-auto inline-flex min-h-6 items-center text-sm text-accent-text underline underline-offset-[3px]"
        >
          Quellen
        </Link>
      </div>

      {filtered.length === 0 ? (
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
      ) : (
        <>
          <Section
            title={grouped ? "Beste Treffer" : "Ergebnisse"}
            description={
              grouped
                ? "Die begründetsten Übereinstimmungen zuerst."
                : "In der von dir gewählten Reihenfolge."
            }
          >
            <ul className="grid gap-4">
              {top.map((scored) => (
                <li key={scored.jobId}>
                  <JobCard
                    scored={scored}
                    t={t}
                    saved={savedIds.has(scored.jobId)}
                    action={
                      <SaveJobButton
                        jobId={scored.jobId}
                        initiallySaved={savedIds.has(scored.jobId)}
                        labels={{ save: t("jobs.save"), saved: t("jobs.saved") }}
                        />
                    }
                  />
                </li>
              ))}
            </ul>
          </Section>

          {alternatives.length > 0 && (
            <Section title="Mutige Alternativen">
              <GroupNote>
                Diese Rollen liegen neben deinem bisherigen Weg. Die Passung ist unsicherer — aber
                sie stützt sich auf Tätigkeiten, die du belegt hast, nicht auf deinen Jobtitel.
                Genau dafür hat {brand.assistantName} vorher gefragt.
              </GroupNote>
              <ul className="mt-4 grid gap-4">
                {alternatives.map((scored) => (
                  <li key={scored.jobId}>
                    <JobCard
                      scored={scored}
                      t={t}
                      saved={savedIds.has(scored.jobId)}
                      action={
                        <SaveJobButton
                          jobId={scored.jobId}
                          initiallySaved={savedIds.has(scored.jobId)}
                          labels={{ save: t("jobs.save"), saved: t("jobs.saved") }}
                          />
                      }
                    />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {fresh.length > 0 && (
            <Section title="Neu diese Woche" description="In den letzten sieben Tagen veröffentlicht.">
              <ul className="grid gap-4">
                {fresh.map((scored) => (
                  <li key={scored.jobId}>
                    <JobCard
                      scored={scored}
                      t={t}
                      saved={savedIds.has(scored.jobId)}
                      action={
                        <SaveJobButton
                          jobId={scored.jobId}
                          initiallySaved={savedIds.has(scored.jobId)}
                          labels={{ save: t("jobs.save"), saved: t("jobs.saved") }}
                          />
                      }
                    />
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}

      {includeBlocked && blockedJobs.length > 0 && (
        <Section
          title="Ausgeschlossene Stellen"
          description="Jede mit dem konkreten Grund. Weiche Stärken können eine harte Bedingung nicht aufwiegen."
        >
          <ul className="grid gap-4">
            {blockedJobs.map((scored) => (
              <li key={scored.jobId}>
                <JobCard scored={scored} t={t} saved={savedIds.has(scored.jobId)} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {blockedCount > 0 && (
        <Card className="grid gap-3">
          <h2 className="text-base font-semibold">
            {blockedCount} {blockedCount === 1 ? "Stelle wurde" : "Stellen wurden"} ausgeschlossen
          </h2>
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            Sie verletzen eine Bedingung, die du als nicht verhandelbar angegeben hast. Weiche
            Stärken können eine harte Bedingung nicht aufwiegen — deshalb stehen sie nicht in der
            Liste. Du kannst sie trotzdem ansehen, jeweils mit dem konkreten Grund.
          </p>
          <p>
            <Button asChild variant="secondary" size="sm">
              <Link href={includeBlocked ? "/app/jobs" : "/app/jobs?blocked=1"} scroll={false}>
                {includeBlocked ? "Wieder ausblenden" : "Mit Begründung anzeigen"}
              </Link>
            </Button>
          </p>
        </Card>
      )}
    </div>
  );
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
