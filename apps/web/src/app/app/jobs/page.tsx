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
import { blätterstand } from "@/lib/jobs/blaettern";
import { JobPagination } from "./JobPagination";
import { JobSplitView } from "./JobSplitView";
import { JobDetailPanel } from "./JobDetailPanel";
import { NinaSearchComposer } from "@/components/jobs/NinaSearchComposer";
import { abdeckungssatz, ladeQuellenabdeckung } from "@/lib/jobs/coverage";

export const metadata: Metadata = { title: "Matches" };
export const dynamic = "force-dynamic";

/**
 * Die Adresse der nächsten Seite.
 *
 * Alle bestehenden Parameter bleiben erhalten — wer gefiltert hat, will
 * beim Blättern nicht von vorn anfangen. `job` fällt weg: die Auswahl
 * der alten Seite auf die neue mitzunehmen wäre verwirrend.
 */
function blätterParams(params: Record<string, string | undefined>, seite: number): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== "seite" && k !== "job") next.set(k, v);
  }
  if (seite > 1) next.set("seite", String(seite));
  return next.toString();
}

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
  const [gate, abdeckung] = await Promise.all([loadGate(user.id), ladeQuellenabdeckung()]);

  // Der Riegel: ohne bestätigtes Mindestprofil keine personalisierten
  // Vorschläge. Kein Gimmick, sondern der Unterschied zwischen
  // Empfehlung und Zufall.
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

  const realCount = filtered.length;

  /*
   * Serverseitige Seitenteilung.
   *
   * Vorher ging `filtered` vollständig in die Liste — bei 994 Stellen
   * waren das 9.291 DOM-Elemente und sechs Sekunden bis zum ersten
   * Bild. Die Seite „laggte" nicht wegen einer Animation, sondern weil
   * der Browser tausend Zeilen bauen musste, von denen man zwölf sieht.
   *
   * 25 je Seite. Wer mehr will, klickt weiter — und bekommt dann auch
   * nur 25 mehr. Eine unendliche Liste ist bequemer zu bauen und
   * teurer zu benutzen.
   */
  const PRO_SEITE = 25;
  // Die Klammer steht in `blaettern.ts` und ist dort geprüft.
  const { seite, seitenGesamt, von, bis } = blätterstand(filtered.length, params.seite, PRO_SEITE);
  const sichtbar = filtered.slice(von, bis);

  // Die Auswahl steht im Suchparameter, damit sie verlinkbar ist und der
  // Zurück-Knopf das Erwartete tut.
  const requested = params.job;
  /*
   * Die Auswahl darf auch außerhalb der aktuellen Seite liegen: ein
   * verlinkter Job muss sich öffnen lassen, egal auf welcher Seite er
   * steht. Deshalb wird in `filtered` gesucht, nicht in `sichtbar`.
   */
  const selected: ScoredJob | null =
    (requested ? filtered.find((j) => j.jobId === requested) : undefined) ?? sichtbar[0] ?? null;

  const rows: JobRowData[] = sichtbar.map((j) => ({
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
    /*
     * `grid-cols-[minmax(0,1fr)]` statt der Vorgabe.
     *
     * Eine Rasterspalte ist standardmässig `auto` und wächst auf die
     * grösste Mindestbreite ihrer Kinder — hier auf 351 Pixel in einem
     * 328 Pixel breiten Behälter. Alle neun Abschnitte wurden dadurch
     * mitgezogen, und die Seite lief auf einem 360-Pixel-Gerät sieben
     * Pixel über.
     *
     * `minmax(0, 1fr)` erlaubt der Spur, kleiner zu werden als ihr
     * Inhalt. Das ist dieselbe Lehre, die weiter unten schon für die
     * Jobliste steht — sie gilt für jedes Raster, nicht nur für das
     * mit den langen Titeln.
     */
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
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

      {/*
       * Die Sperre sperrt die PERSONALISIERUNG, nicht die Seite.
       *
       * Vorher ersetzte sie die ganze Jobliste durch einen Hinweis: wer
       * sein Gespräch noch nicht weit genug geführt hatte, sah gar keine
       * Stellen. Das war zu viel. Die Anzeigen sind echt und öffentlich
       * — sie zurückzuhalten schützt niemanden. Was ohne belegtes Profil
       * nicht geht, ist die Reihenfolge zu begründen, und genau das
       * steht hier.
       */}
      {!gate.unlocked && (
        <div className="rounded-(--radius-surface) bg-accent-soft px-5 py-4">
          <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
            <span className="font-medium text-ink">
              Diese Reihenfolge ist noch nicht auf dich zugeschnitten.
            </span>{" "}
            {gate.reason}{" "}
            <Link
              href={gate.profileConfirmed ? "/app/nina" : "/app/career"}
              className="text-accent-text underline underline-offset-[3px]"
            >
              {gate.profileConfirmed ? t("jobs.lockedCta") : "Profil bestätigen"}
            </Link>
          </p>
        </div>
      )}

      {/* Zuerst der Weg in Worten, danach die Filter. Wer eine
          Bedingung nennen kann, die kein Feld abbildet, soll sie nicht
          erst in Felder übersetzen müssen. */}
      <NinaSearchComposer assistantName={brand.assistantName} />

      <Suspense fallback={<SkeletonText lines={2} />}>
        <JobFilters resultCount={filtered.length} />
      </Suspense>

      {/*
        Was wirklich durchsucht wurde — mit gezählten Zahlen.
        „23 Stellen" sagt nichts darüber, ob 23 von 30 oder 23 von
        30.000 übrig blieben. Und bei einer aktiven Quelle steht „1
        Quelle" da, nicht „das ganze Internet".
      */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <p className="text-ink-2">{abdeckungssatz(abdeckung, realCount)}</p>
        {abdeckung.zuletzt && (
          <span className="text-ink-3">
            zuletzt aktualisiert{" "}
            {new Intl.DateTimeFormat("de-DE", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }).format(abdeckung.zuletzt)}
          </span>
        )}
        <Link
          href="/app/settings/integrations"
          /* `inline-flex` mit Mindesthöhe: als reiner Textlink war das
             Ziel 23 Pixel hoch und damit einen Pixel unter dem
             Mindestmass aus WCAG 2.5.8. */
          className="ml-auto inline-flex min-h-6 items-center text-accent-text underline underline-offset-[3px]"
        >
          Quellen ansehen
        </Link>
      </div>

      <JobSplitView
        rows={rows}
        selectedId={selected?.jobId ?? null}
        explicitSelection={Boolean(requested)}
        emptyState={
          /*
           * Die leere Liste erklärt sich (§16.4).
           *
           * Zwei Dinge stehen hier bewusst NICHT: keine ähnlichen
           * Stellen „die auch interessant sein könnten", und keine
           * automatisch gelockerte Bedingung. Eine Suche, die von
           * selbst weiter wird, wenn sie nichts findet, ist keine
           * Suche mehr — sie liefert dann Ergebnisse, die niemand
           * verlangt hat, und der Mensch hält sie für Treffer.
           *
           * Stattdessen: welche Bedingungen gerade gelten, und je ein
           * Angebot, genau eine davon fallen zu lassen. Erweitert wird
           * erst nach einem Klick.
           */
          <EmptyState
            icon={<Compass className="size-5" strokeWidth={1.7} />}
            title="Mit diesen Bedingungen finde ich aktuell keine bestätigte Stelle"
            body={
              aktiveBedingungen(params).length > 0
                ? `Es gilt gerade: ${aktiveBedingungen(params)
                    .map((b) => b.label)
                    .join(", ")}. Soll ich eine davon einmalig weglassen? Es wird nichts ausgedacht, um die Liste zu füllen.`
                : "Es wird nichts ausgedacht, um die Liste zu füllen."
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {aktiveBedingungen(params).map((b) => (
                  <Button key={b.key} asChild variant="secondary">
                    <Link href={`/app/jobs?${ohneBedingung(params, b.key)}`}>
                      Ohne „{b.label}“
                    </Link>
                  </Button>
                ))}
                <Button asChild variant="secondary">
                  <Link href="/app/jobs">Alle Filter zurücksetzen</Link>
                </Button>
              </div>
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

      {/*
       * Blättern statt endlos scrollen.
       *
       * Serverseitige Links, keine Client-Zustandsmaschine: jede Seite
       * hat eine eigene Adresse, der Zurück-Knopf tut das Erwartete,
       * und ein geteilter Link führt dorthin, wo der Absender war.
       */}
      {seitenGesamt > 1 && (
        <JobPagination
          seite={seite}
          seitenGesamt={seitenGesamt}
          sichtbar={sichtbar.length}
          gesamt={filtered.length}
          zurückHref={seite > 1 ? `/app/jobs?${blätterParams(params, seite - 1)}` : null}
          weiterHref={seite < seitenGesamt ? `/app/jobs?${blätterParams(params, seite + 1)}` : null}
          weitereAnzahl={Math.min(PRO_SEITE, filtered.length - seite * PRO_SEITE)}
        />
      )}

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

  /*
   * Ausschlüsse.
   *
   * Ein Wort aus dieser Liste im Titel, in den Aufgaben oder in der
   * Branche schliesst die Stelle aus. Bewusst dieselbe Textbasis wie
   * die Suche — sonst hiesse „ohne Kaltakquise" etwas anderes als
   * „Kaltakquise".
   */
  const nicht = params.nicht?.trim().toLowerCase();
  if (nicht) {
    const verboten = nicht.split(/\s+/).filter((w) => w.length > 2);
    result = result.filter((j) => {
      const haystack = [j.job.title, j.job.industry ?? "", ...j.job.coreTasks]
        .join(" ")
        .toLowerCase();
      return !verboten.some((w) => haystack.includes(w));
    });
  }

  /*
   * Der Ort als eigener Filter.
   *
   * Vorher landete er im Volltext und traf damit auch Firmen, die eine
   * Stadt im Namen tragen — „Berlin" fand die „Berlin Brands Group" in
   * Hamburg. Auf das Ortsfeld angewandt trifft er das, was gemeint ist.
   */
  const ort = params.ort?.trim().toLowerCase();
  if (ort) result = result.filter((j) => j.job.location.toLowerCase().includes(ort));

  if (params.remote) result = result.filter((j) => j.job.workModel === params.remote);
  if (params.contract) result = result.filter((j) => j.job.contractType === params.contract);
  if (params.salary === "disclosed") result = result.filter((j) => j.job.salary.disclosed);

  /*
   * Mindestgehalt.
   *
   * Geprüft wird die Untergrenze der Spanne: eine Stelle mit
   * 42.000–55.000 erfüllt „ab 45.000" nicht sicher, und eine Suche
   * darf nicht optimistisch runden. Stellen ohne Angabe fallen hier
   * nicht heimlich durch — dafür sorgt `salary=disclosed`, das die
   * Sucherkennung zusammen mit dem Betrag setzt.
   */
  const gehaltAb = Number(params.gehaltAb);
  if (Number.isFinite(gehaltAb) && gehaltAb > 0) {
    result = result.filter((j) => {
      const von = j.job.salary.min ?? j.job.salary.max;
      if (typeof von !== "number") return false;
      /*
       * Auf ein Jahr umrechnen, bevor verglichen wird.
       *
       * Anzeigen nennen Monats-, Stunden- und Jahresbeträge bunt
       * gemischt. Ein Vergleich der rohen Zahl gegen 45.000 wirft jede
       * Stelle raus, die „4.000 € im Monat" schreibt — also 48.000 im
       * Jahr und damit genau das, was gesucht war.
       */
      const proJahr =
        j.job.salary.period === "month"
          ? von * 12
          : j.job.salary.period === "hour"
            ? von * 40 * 52
            : von;
      return proJahr >= gehaltAb;
    });
  }

  const sinceDays = Number(params.since);
  if (Number.isFinite(sinceDays) && sinceDays > 0) {
    const cutoff = Date.now() - sinceDays * 86_400_000;
    result = result.filter((j) => (j.job.publishedAt?.getTime() ?? 0) >= cutoff);
  }

  return result;
}

/**
 * Welche Bedingungen gerade gelten — in Worten, nicht als Feldnamen.
 *
 * Sie stehen in der leeren Liste, damit niemand raten muss, warum sie
 * leer ist. Der häufigste Grund für „die Suche ist kaputt" ist ein
 * Filter, den man vor zwei Minuten gesetzt und längst vergessen hat.
 */
function aktiveBedingungen(
  params: Record<string, string | undefined>,
): { key: string; label: string }[] {
  const raus: { key: string; label: string }[] = [];
  const arbeitsmodell: Record<string, string> = {
    remote: "nur remote",
    hybrid: "höchstens zwei Bürotage",
    onsite: "vor Ort",
  };
  const vertrag: Record<string, string> = {
    permanent: "unbefristet",
    temporary: "befristet",
    freelance: "freiberuflich",
    internship: "Praktikum oder Werkstudium",
  };

  if (params.q) raus.push({ key: "q", label: params.q });
  if (params.nicht) raus.push({ key: "nicht", label: `ohne ${params.nicht}` });
  if (params.ort) raus.push({ key: "ort", label: `rund um ${params.ort}` });
  if (params.remote && arbeitsmodell[params.remote]) {
    raus.push({ key: "remote", label: arbeitsmodell[params.remote]! });
  }
  if (params.contract && vertrag[params.contract]) {
    raus.push({ key: "contract", label: vertrag[params.contract]! });
  }
  if (params.gehaltAb) {
    raus.push({
      key: "gehaltAb",
      label: `ab ${Number(params.gehaltAb).toLocaleString("de-DE")} €`,
    });
  }
  if (params.since) raus.push({ key: "since", label: `aus den letzten ${params.since} Tagen` });
  return raus;
}

/** Dieselbe Adresse ohne genau eine Bedingung. */
function ohneBedingung(params: Record<string, string | undefined>, key: string): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || k === key) continue;
    /*
     * Ein Mindestgehalt bringt „nur mit Gehaltsangabe" mit. Fällt der
     * Betrag weg, muss die Angabe mitfallen — sonst bleibt eine
     * Bedingung stehen, die niemand gesetzt hat und die in der Liste
     * der aktiven Bedingungen gar nicht auftaucht.
     */
    if (key === "gehaltAb" && k === "salary") continue;
    next.set(k, v);
  }
  return next.toString();
}
