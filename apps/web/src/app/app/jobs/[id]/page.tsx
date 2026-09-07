import { herkunftAusArt, linkTextMitZiel } from "@paycheck/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Clock, ExternalLink, HelpCircle, MapPin } from "lucide-react";
import { eq, and } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { coverLetterAdvisable } from "@paycheck/documents";
import { requireUser } from "@/lib/auth";
import { getPageContext } from "@/lib/locale";
import { after } from "next/server";
import { loadScoredJob, persistMatch } from "@/lib/matching";
import { Badge, Card, Disclosure, Separator } from "@/components/ui";
import { MetricValue, ScoreRing } from "@/components/ui/score";
import { SourceNote } from "@/components/ui/states";
import { BlockedNotice, FactorBreakdown } from "@/components/scores";
import { JobActions } from "./JobActions";
import { JobKurzfragen } from "@/components/jobs/JobKurzfragen";
import { ViewTracker } from "./ViewTracker";
import { NinaScope } from "@/components/nina/NinaScope";
import { JobKopf } from "@/components/jobs/JobKopf";
import { Passungsbefund } from "@/components/jobs/Passungsbefund";
import { twinLaden } from "@/lib/arbeitsprofil";
import { Rollenkarte } from "@/components/jobs/Rollenkarte";
import { PromiseKeptBlock } from "@/components/jobs/PromiseKeptBlock";
import { Realitaetsblock } from "@/components/jobs/Realitaetsblock";
import { Antwortblock } from "@/components/jobs/Antwortblock";
import { antwortquoteFuerFirma } from "@/lib/antwortquote";
import { angeboteFuerStelle, realitaetsbild } from "@/lib/realitaetsproben";
import { promiseKeptFuerFirma } from "@/lib/zusagen";
import { rollenkarteLaden } from "@/lib/rollenwahrheit";
import { standzeitLaden } from "@/lib/jobs/standzeit";
import { volltextErlaubt } from "@paycheck/sources";
import { Standzeitblock } from "@/components/jobs/Standzeitblock";
import { Anzeigentext } from "@/components/jobs/Anzeigentext";
import { Uebersetzungshinweis } from "@/components/jobs/Uebersetzungshinweis";
import { uebersetzungAusSpeicher, uebersetzungErzeugen } from "@/lib/jobs/uebersetzung";
import { Zukunftsblock } from "@/components/jobs/Zukunftsblock";
import { Passungsgruende } from "@/components/jobs/Passungsgruende";
import { zukunftLaden } from "@/lib/jobs/zukunft";
import { anzeigenklartext } from "@paycheck/domain";
import { dimensionenVergleichen, stellenDimensionen } from "@paycheck/matching";
import { betrag } from "@/lib/jobs/geld";
import { anzeigenqualitaet } from "@/lib/lebenswert/luecken";
import { BEFUNDTON } from "@/lib/jobs/befundton";
import { Leistungen } from "@/components/jobs/Leistungen";
import { Arbeitswegblock } from "@/components/jobs/Arbeitswegblock";
import { LifeFitBlock } from "@/components/jobs/LifeFitBlock";
import { Nettorechner } from "@/components/jobs/Nettorechner";
import { ladeGehaltsangaben } from "@/lib/payroll/einstellungen";
import { ladeLebenshaltung } from "@/lib/lebenswert/speicher";
import { vergleichswert } from "@/lib/jobs/gehaltsvergleich";

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

  /*
   * Was die Stelle nicht braucht, wartet nicht auf sie.
   *
   * Fünf dieser Ladevorgänge hängen allein an der Nutzer- oder der
   * Stellenkennung — beide stehen im Aufruf. Sie standen trotzdem
   * hinter `loadScoredJob`, das mit Profil, Bewertung und Beschreibung
   * knapp vierhundert Millisekunden braucht.
   *
   * Jetzt laufen sie daneben. Die zwei, die den bewerteten Datensatz
   * wirklich brauchen — Vergleichswert und Rollenkarte — stehen
   * darunter.
   */
  const db = await getDb();
  const nebenherLaeuft = Promise.all([
    withUser(db, user.id, (tx) =>
      tx
        .select({ baseLocation: schema.userSettings.baseLocation })
        .from(schema.userSettings)
        .where(eq(schema.userSettings.userId, user.id))
        .limit(1),
    ).catch(() => [] as { baseLocation: string | null }[]),
    ladeGehaltsangaben(),
    ladeLebenshaltung(),
    twinLaden(user.id).catch(() => new Map() as Awaited<ReturnType<typeof twinLaden>>),
    withUser(db, user.id, (tx) =>
      tx
        .select({ jobId: schema.savedJobs.jobId })
        .from(schema.savedJobs)
        .where(and(eq(schema.savedJobs.userId, user.id), eq(schema.savedJobs.jobId, id)))
        .limit(1),
    ).catch(() => [] as { jobId: string }[]),
  ]);

  const scored = await loadScoredJob(user.id, id);
  if (!scored) notFound();

  /*
   * Die gezeigte Bewertung festhalten — nach der Antwort, nicht davor.
   *
   * ── Was hier gefehlt hat ──────────────────────────────────────
   *
   * `persistMatch` stand seit dem ersten Entwurf im Code, exportiert,
   * mit Kommentar — und wurde nirgends aufgerufen. `job_matches` hatte
   * deshalb null Zeilen, und drei Dinge liefen ins Leere:
   *
   *   1. `vorhersageFesthalten` findet nichts und gibt still auf. Die
   *      30/90/180-Schleife kann nie beginnen, weil es keine
   *      eingefrorene Vorhersage gibt, gegen die man prüfen könnte.
   *   2. Der Arbeitgeber sieht bei jeder Bewerbung ein leeres Fit-Band.
   *   3. Monday weiss nicht, wie die Stelle bewertet wurde, über die
   *      gerade gesprochen wird.
   *
   * ── Warum `after` und nicht davor ─────────────────────────────
   *
   * Das Schreiben kostet einen Rundlauf zur Datenbank, und die Stelle
   * ist bereits fertig berechnet. Vor der Antwort zu schreiben hiesse,
   * jede Seitenansicht um diesen Rundlauf zu verlängern, damit später
   * jemand eine Auswertung machen kann. `after` läuft, nachdem die
   * Antwort raus ist.
   *
   * Ein Fehlschlag bleibt folgenlos: Die Seite steht dann trotzdem,
   * und beim nächsten Aufruf wird es erneut versucht.
   */
  after(async () => {
    await persistMatch(user.id, scored).catch(() => {});

    /*
     * Die Übersetzung nach der Antwort erzeugen.
     *
     * Der erste Besucher sieht das Original, der nächste die
     * Übersetzung. Das ist der ehrliche Handel: Niemand wartet zwei
     * Minuten auf eine Seite, und niemand bekommt eine erfundene
     * Fassung, während er wartet.
     */
    /*
     * Nur übersetzen, was auch gezeigt werden darf.
     *
     * ── Was hier falsch war ───────────────────────────────
     *
     * Die Erzeugung lief für jede fremdsprachige Anzeige — auch für
     * die 26 von 28 Quellen, deren Volltext wir nicht wiedergeben
     * dürfen. Das kostete einen Modellaufruf für einen Text, der
     * niemals erscheinen kann.
     *
     * Und es wäre auch rechtlich verkehrt gewesen: Eine Übersetzung
     * eines Textes, den wir nicht wiedergeben dürfen, ist ebenfalls
     * eine Wiedergabe.
     */
    if (uebersetzt === null && scored.originalLanguage && volltextErlaubt(source?.key)) {
      await uebersetzungErzeugen(
        {
          id: job.id,
          title: job.title,
          description: job.description ?? "",
          originalLanguage: scored.originalLanguage,
        },
        user.locale ?? "de",
      ).catch(() => {});
    }
  });

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

  /*
   * Was die neuen Abschnitte brauchen, in einem Zug.
   *
   * Wohnort, Steuerangaben und Fixkosten liegen in drei Tabellen.
   * Nacheinander geladen wären es drei Netzrunden zu Supabase, bevor die
   * Seite überhaupt anfängt zu zeichnen.
   */
  /*
   * Alles gleichzeitig, was nicht voneinander abhängt.
   *
   * ── Warum das so viel ausmacht ────────────────────────────
   *
   * Diese Seite bezahlt keine Rechenzeit, sondern Netzrunden. Gemessen
   * gegen die Datenbank: eine Abfrage 43 ms, ein `withUser` mit einer
   * Abfrage 174 ms (BEGIN, Rolle, Abfrage, COMMIT), drei Abfragen
   * nebeneinander zusammen 46 ms.
   *
   * Hier standen vier Blöcke NACHEINANDER: Einstellungen, dann der
   * Career Twin, dann die Rollenkarte, dann die gemerkte Stelle. Vier
   * Transaktionen, über 600 Millisekunden, in denen nichts gerechnet
   * wird — die Verbindung wartet.
   *
   * Keiner davon braucht das Ergebnis eines anderen. Nebeneinander
   * kosten sie so viel wie der langsamste.
   */
  const [[einstellungen, gehaltsangaben, lebenshaltung, twin, savedRow], vergleich, rollenkarte, promiseKeptScore, realBild, realAngebote, antwort, standzeitAngabe, zukunft, uebersetzt] =
    await Promise.all([
      nebenherLaeuft,
      /*
       * Nur wo die Anzeige selbst nichts nennt.
       *
       * Neben einer echten Zahl wäre ein Vergleichswert Lärm — und
       * schlimmer: Er lädt dazu ein, beide zu verwechseln.
       */
      job.salary.min === null && job.salary.max === null
        ? vergleichswert(job.title, job.coreTasks, job.kldb ?? null)
        : Promise.resolve(null),
      rollenkarteLaden(job).catch(() => null),
      /* Hält dieser Arbeitgeber, was er zusagt? Die Frage gehört vor
         die Entscheidung, nicht hinter sie. */
      promiseKeptFuerFirma(job.companyId).catch(() => null),
      /* Mit Bezug: erst die Stelle, dann derselbe Beruf beim selben
         Arbeitgeber, dann die Berufsgruppe. Ohne ihn stünde fast
         immer nichts da, obwohl über den Beruf etwas bekannt ist. */
      realitaetsbild(job.id, { companyId: job.companyId, kldb: job.kldb }).catch(() => null),
      angeboteFuerStelle(job.id).catch(() => []),
      /* Antwortet dieser Arbeitgeber überhaupt? Die Frage kostet den
         Suchenden sonst eine Stunde je Bewerbung. */
      antwortquoteFuerFirma(job.companyId).catch(() => null),
      /*
       * Steht diese Anzeige seit zehn Monaten?
       *
       * Ein Nachschlag in einer Tabelle mit 36 Zeilen — er läuft in
       * derselben Runde wie alles andere und kostet damit keinen
       * eigenen Rundlauf.
       */
      standzeitLaden(job.kldb ?? null, job.publishedAt ?? null).catch(() => null),
      /* Ein Nachschlag über 436 Zeilen, gruppiert — in derselben Runde. */
      zukunftLaden(job.kldb ?? null).catch(() => null),
      /*
       * Nur ein Nachschlag, kein Modellaufruf.
       *
       * Beides in einem hatte die Seite über zwei Minuten blockiert:
       * Ein Modellaufruf im Renderpfad hält die ganze Antwort an, für
       * jeden, der die Seite öffnet. Erzeugt wird unten in `after`.
       */
      uebersetzungAusSpeicher(
        { id: job.id, originalLanguage: scored.originalLanguage ?? null },
        user.locale ?? "de",
      ).catch(() => null),
    ]);

  const ctxWohnort = einstellungen[0]?.baseLocation ?? null;
  /* Rein rechnerisch — ein Dutzend reguläre Ausdrücke über Text, der
     ohnehin geladen ist. Kein zusätzlicher Netzaufruf. */
  const alltag = dimensionenVergleichen(twin, stellenDimensionen(job));

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

  // Dieselbe Formatierung wie in der Liste — aus `geld.ts`.
  const money = (value: number) => betrag(value, job.salary.currency);

  return (
    <div className="grid gap-8">
      {/* Monday weiß ab hier, worüber gesprochen wird. */}
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

      {/*
       * ══ Kopf ══════════════════════════════════════════════
       *
       * Derselbe Kopf wie in der geteilten Ansicht — ein Bauteil, zwei
       * Routen.
       *
       * Hier standen bis eben 75 eigene Zeilen: andere Reihenfolge,
       * kein Bild, kein Netto, und das alte Gehalt-Wording. Ein Umbau
       * der Spalte liess diese Seite unberührt, und im Browser stand
       * dann mal das Neue und mal das Alte — je nachdem, über welchen
       * Weg jemand hergekommen war.
       */}
      <JobKopf
        titelAls="h1"
        assistantName={brand.assistantName}
        daten={{
          job,
          firma: scored.firma ?? null,
          quelle: source?.displayName ?? null,
          herkunft: source ? herkunftAusArt(source.kind) : null,
          bedingungen: scored.constraints,
          veraltet: listingConfidence.possiblyStale,
          score: fit.score,
          bandText: bandText,
          grund: fit.topReason || null,
          vorbehalt: fit.topReservation || null,
          empfehlung: null,
          gesperrt: constraints.overall === "blocked",
          vergleich,
        }}
      />

      <BlockedNotice constraints={constraints} t={t} />

      {/* ══ Zwei Spalten ═════════════════════════════════════ */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
        <div className="grid min-w-0 gap-8">
          {/*
            Warum diese Stelle — zwei Sätze, nicht fünf.
            
            Hier standen zusätzlich „Was dagegen spricht" und „Warum die
            Sicherheit nicht höher ist" in voller Länge. Drei technische
            Absätze noch vor den Aufgaben, und alle drei sagten bei einem
            frischen Konto dasselbe: wir wissen zu wenig. Der Vorbehalt
            steht jetzt weiter unten bei „Was noch unklar ist", wo er
            hingehört.
          */}
          <Card className="border-assistant-border bg-assistant-soft">
            <Badge tone="assistant">{t("jobDetail.whyShown")}</Badge>
            <p className="mt-4 max-w-[var(--measure)] leading-relaxed">{fit.topReason}</p>
          </Card>

          {/*
           * Der Befund im Einzelnen.
           *
           * Ein Satz „warum wir sie zeigen" beantwortet die Frage nach
           * dem Grund. Er beantwortet nicht, ob die formalen
           * Anforderungen erfüllt sind, ob die Tätigkeit zu den
           * Fähigkeiten passt, ob der Alltag zur Lebenssituation passt
           * und wie sicher das alles ist. Das sind vier Fragen, und
           * gerechnet werden sie längst getrennt.
           */}
          <Card>
            <Passungsbefund fit={fit} confidence={confidence} bedingungen={constraints} alltag={alltag} />
            {/*
              * Die ausführliche Begründung unter der Einstufung.
              *
              * `Passungsbefund` zeigt die Stufen — formale
              * Anforderungen, Fähigkeiten, Alltag, Sicherheit. Hier
              * steht, WORAN es liegt: jede Achse, die deutlich dafür
              * oder dagegen spricht, mit ihrem eigenen Satz. Und die
              * dritte Liste, die es vorher nirgends gab: was schlicht
              * nicht in der Anzeige steht.
              */}
            <Passungsgruende factors={fit.factors} />
          </Card>

          {/*
           * Die Arbeitsrealität vor allem anderen inhaltlichen.
           *
           * Wer wissen will, ob eine Stelle zu ihm passt, fragt zuerst
           * „was mache ich den ganzen Tag" — nicht „welche
           * Anforderungen gibt es". Die Anforderungsliste steht
           * weiterhin darunter.
           */}
          {rollenkarte && <Rollenkarte karte={rollenkarte} />}
          {(promiseKeptScore || antwort) && (
            <Card>
              <div className="grid gap-5">
                {promiseKeptScore && (
                  <PromiseKeptBlock score={promiseKeptScore} firma={job.companyName} />
                )}
                {antwort && <Antwortblock quote={antwort} firma={job.companyName} />}
              </div>
            </Card>
          )}
          {realBild && <Realitaetsblock bild={realBild} angebote={realAngebote} jobId={job.id} />}
          {standzeitAngabe && <Standzeitblock angabe={standzeitAngabe} />}

            {/*
              * Die beiden Rechner, mit dieser Stelle im Gepäck.
              *
              * Beide öffnen sich vorbelegt und sagen, woher die Zahl
              * kommt — und beide haben einen Weg zurück ins Leere. Ohne
              * Kennzeichnung bliebe die Zahl kleben, und die nächste
              * Rechnung gälte heimlich für diese Stelle.
              */}
            <Card>
              <div className="grid gap-2">
                <h2 className="abschnitts-titel text-ink-3">
                  Selbst nachrechnen
                </h2>
                <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
                  <Link
                    href={`/app/tools/gehalt?jobId=${job.id}`}
                    className="text-accent-text underline underline-offset-[3px]"
                  >
                    Was bleibt mir bei diesem Gehalt übrig?
                  </Link>
                  {" · "}
                  <Link
                    href={`/app/tools/route?jobId=${job.id}`}
                    className="text-accent-text underline underline-offset-[3px]"
                  >
                    Was kostet mich der Weg?
                  </Link>
                </p>
              </div>
            </Card>

          {/* ══ Was der Job für dein Leben bedeutet ═══════════ */}
          <section aria-labelledby="lifefit" className="grid gap-4">
            <h2 id="lifefit" className="text-xl font-semibold">
              Was bedeutet der Job für deinen Alltag?
            </h2>
            <Card>
              <LifeFitBlock job={job} wohnort={ctxWohnort} />
            </Card>
          </section>

          {/* ══ Arbeitsweg ═══════════════════════════════════ */}
          <section aria-labelledby="arbeitsweg" className="grid gap-4">
            <h2 id="arbeitsweg" className="text-xl font-semibold">
              Dein Arbeitsweg
            </h2>
            <Card>
              <Arbeitswegblock job={job} wohnort={ctxWohnort} />
            </Card>
          </section>

          {/* ══ Was bleibt netto ═════════════════════════════ */}
          <section aria-labelledby="netto" className="grid gap-4">
            <h2 id="netto" className="text-xl font-semibold">
              Was bleibt dir netto?
            </h2>
            <Card>
              <Nettorechner
                bruttoVon={job.salary.min}
                bruttoBis={job.salary.max}
                waehrung={job.salary.currency}
                zeitraum={job.salary.period}
                land={job.country || "DE"}
                angaben={gehaltsangaben}
                kosten={lebenshaltung}
                pendelkosten={null}
              />
            </Card>
          </section>

          {/* Aufgaben */}
          <section aria-labelledby="alltag" className="grid gap-4">
            <h2 id="alltag" className="text-xl font-semibold">
              Der Arbeitsalltag
            </h2>

            {job.coreTasks.length > 0 ? (
              <Card>
                <h3 className="text-base font-semibold">{t("jobDetail.coreTasks")}</h3>
                <ul className="mt-3.5 grid gap-2.5">
                  {/*
                    * Auch hier durch den Normalisierer.
                    *
                    * 6,6 Prozent der Aufgabenlisten im Bestand tragen
                    * Markup — „**Ihre Aufgaben:**" steht als eigener
                    * Aufgabenpunkt darin. Der Import säubert das seit
                    * heute; die 1,7 Millionen Zeilen davor nicht.
                    */}
                  {job.coreTasks.map((task) => (
                    <li key={task} className="flex gap-2.5 text-sm leading-relaxed">
                      <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-ink-3" />
                      <span className="text-ink-2">{anzeigenklartext(task)}</span>
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

            {/*
              * Der Anzeigentext — nur wo die Quelle ihn hergibt.
              *
              * Die Quellenregistrierung sagt bei 26 von 28 Quellen
              * ausdrücklich das Gegenteil: erlaubt sind Metadaten und
              * eine Zusammenfassung, nicht der Text selbst. Hier stand
              * er trotzdem, für jede Quelle gleich.
              *
              * Was bleibt, ist das Abgeleitete darüber — Aufgaben,
              * Anforderungen, Bewertung. Auswerten ist erlaubt,
              * wörtlich wiedergeben nicht.
              */}
            {volltextErlaubt(source?.key) ? (
              <Disclosure summary="Vollständige Stellenbeschreibung">
                {uebersetzt ? (
                  <Uebersetzungshinweis
                    uebersetzt={uebersetzt.beschreibung}
                    original={job.description ?? ""}
                    ausSprache={uebersetzt.ausSprache}
                  />
                ) : (
                  <Anzeigentext text={job.description} />
                )}
              </Disclosure>
            ) : (
              <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-3">
                Den vollständigen Anzeigentext dürfen wir von dieser Quelle nicht wiedergeben — was
                oben steht, ist daraus abgeleitet.{" "}
                {job.originalUrl && (
                  <a
                    href={job.originalUrl}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-accent-text underline underline-offset-[3px]"
                  >
                    Zur Originalanzeige
                  </a>
                )}
              </p>
            )}
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

            {/*
             * Leistungen direkt nach den Anforderungen.
             *
             * Die Anzeige stellt hier ihre Forderungen; unmittelbar
             * danach steht, was sie im Gegenzug nennt. Weiter unten
             * zwischen Passung und Unternehmen ginge die Beziehung
             * zwischen beidem verloren.
             */}
            <Card>
              <h3 className="text-base font-semibold">Was die Anzeige bietet</h3>
              <div className="mt-4">
                <Leistungen beschreibung={job.description} />
              </div>
            </Card>

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

            {/*
              * Was über die Berufsgruppe bekannt ist — vor der
              * Einschätzung zu dieser einen Anzeige.
              *
              * Der Abschnitt darunter bewertet die Aufgaben dieser
              * Rolle. Beides zusammen ist die ehrliche Antwort: was
              * die Studienlage zur Gruppe sagt, und was in dieser
              * Anzeige steht. Fehlt die Berufskennung, steht der
              * erste Teil nicht da statt zu raten.
              */}
            {zukunft && <Zukunftsblock angabe={zukunft} />}

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
                Diese Fragen leiten sich aus dem ab, was in der Anzeige fehlt oder unklar bleibt.{" "}
                {(() => {
                  /*
                   * Wie viel die Anzeige überhaupt hergibt — in Worten.
                   *
                   * Bewusst keine Prozentzahl: „73 % gegen 68 %" lädt zum
                   * Vergleichen zwischen Arbeitgebern ein, und dafür sind
                   * sechs geprüfte Felder keine Grundlage.
                   */
                  const q = anzeigenqualitaet(job, requirements.length);
                  return `Von ${q.vollstaendigkeit.moeglich} Grundangaben stehen ${q.vollstaendigkeit.von} in dieser Anzeige.`;
                })()}
              </p>
              <ul className="mt-4 grid gap-3">
                {buildQuestions(scored, requirements.length).map((q) => (
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
                      {/*
                        Diese Signale sagen, was WIR über die Anzeige
                        wissen — nicht, was mit ihr nicht stimmt.

                        „Arbeitgeber nachvollziehbar: nein" heisst, dass
                        die Anzeige über einen Sammeldienst kam und wir
                        den Arbeitgeber nicht direkt bestätigen können.
                        Das war rot mit einem ✕ — und stand damit als
                        Vorwurf gegen ein Unternehmen, das nichts
                        gemacht hat.

                        Nicht bestätigt ist offen, nicht falsch.
                      */}
                      <span
                        aria-hidden
                        className={
                          BEFUNDTON[s.ok === true ? "positiv" : "offen"].text
                        }
                      >
                        {s.ok === true ? "✓" : "?"}
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
              {/*
                Die drei Striche für die Sicherheit sind weg.
                
                Sie waren eine eigene Anzeigeart für eine Grösse, die
                anderswo als Zahl und als Leiste steht — drei Formen für
                dasselbe. `Passungsbefund` weiter unten auf dieser Seite
                nennt die Sicherheit mit eigener Zeile und Begründung.
              */}
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
                {/*
                  Dieselbe Regel wie oben im Kopf: der Link nennt sein
                  Ziel. `common.openOriginal` lautete „Im Original
                  öffnen" und stand hier über einem Link zu einer
                  Sammelstelle — dieselbe Falschaussage, nur an zweiter
                  Stelle. Zwei Beschriftungen für einen Link laufen
                  ohnehin auseinander; jetzt kommen beide aus
                  `linkText`.
                */}
                {linkTextMitZiel(source ? herkunftAusArt(source.kind) : "aggregator", source?.displayName ?? null, job.originalUrl)}
                <ExternalLink className="size-3.5" strokeWidth={1.9} />
              </a>
            )}
          </Card>

          {/*
            Derselbe Inline-Chat wie in der geteilten Ansicht.
            
            Hier standen Links nach /app/monday?job=… — ein Klick nahm
            einem die Anzeige weg, über die man gerade eine Frage hatte.
            Jetzt bleibt die Stelle stehen und die Antwort erscheint
            darunter, gebunden an genau diese job_id.
          */}
          <JobKurzfragen jobId={job.id} assistantName={brand.assistantName} />
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
function buildQuestions(
  scored: Awaited<ReturnType<typeof loadScoredJob>>,
  anzahlAnforderungen = 0,
): string[] {
  if (!scored) return [];
  const questions: string[] = [];
  const { job, constraints, jobQuality, aiTransition, themes } = scored;

  /*
   * Die Fragen nach fehlenden Angaben kommen aus `anzeigenqualitaet`.
   *
   * Sie standen hier einmal ausgeschrieben, und zwar in einer Fassung,
   * die zwei Fehler hatte:
   *
   *   Sie fragte nach dem Gehalt, sobald `disclosed` falsch war. Seit
   *   „disclosed" die HERKUNFT bezeichnet und nicht die Sichtbarkeit,
   *   heisst das auch bei einer Anzeige, in deren Text eine Spanne
   *   steht und die sie oben gross zeigt. Eine Frage nach etwas, das
   *   zwei Absätze weiter oben steht, untergräbt jede weitere.
   *
   *   Und sie prüfte weder das Arbeitsmodell noch, ob überhaupt
   *   Anforderungen extrahiert wurden.
   *
   * Beides steht jetzt an einer Stelle, mit Tests daneben.
   */
  for (const l of anzeigenqualitaet(job, anzahlAnforderungen).luecken) {
    questions.push(l.frage);
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
