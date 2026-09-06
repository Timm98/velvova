import { Suspense } from "react";
import { herkunftAusArt } from "@paycheck/domain";
import Link from "next/link";
import { ExternalLink, ShieldAlert } from "lucide-react";
import type { Translator } from "@paycheck/i18n";
import type { ScoredJob } from "@/lib/matching";
import { recommendationLabel, type DecisionBrief } from "@/lib/applications/decision-brief";
import { Badge, Button, Separator } from "@/components/ui";
import { Passungsbefund } from "@/components/jobs/Passungsbefund";
import { NinaAnalyse } from "@/components/jobs/NinaAnalyse";
import { NinaFragenKnopf } from "@/components/nina/NinaFragenKnopf";
import type { WorkspaceDaten } from "./nina/daten";
import { JobKopf } from "@/components/jobs/JobKopf";
import { BerufsFragen } from "@/components/jobs/BerufsFragen";
import { Arbeitswegblock } from "@/components/jobs/Arbeitswegblock";
import { Nettorechner } from "@/components/jobs/Nettorechner";
import { Fehlergrenze } from "@/components/Fehlergrenze";
import type { Gehaltsangaben } from "@/lib/payroll/einstellungen";
import type { Lebenshaltung } from "@/lib/lebenswert/speicher";
import { SaveJobButton } from "./SaveJobButton";

/**
 * Die ausgewählte Stelle in der rechten Spalte.
 *
 * Sie liest sich wie eine redaktionelle Seite, nicht wie ein Stapel
 * Karten: Bild, Titel, Unternehmen, Eckdaten, Passung, Handlung. Alles
 * frei auf der Fläche, ohne Rahmen umeinander — rechts steht nun einmal
 * genau eine Stelle, und ein Kasten darum würde sie zu einem Eintrag in
 * einer Sammlung machen.
 *
 * Die Reihenfolge folgt dem, was jemand beim Lesen entscheidet:
 *
 *   1. Wovon handelt das hier?   Bild, Titel, Unternehmen
 *   2. Kommt es überhaupt infrage?  Ort, Modell, Vertrag, Gehalt
 *   3. Passt es zu mir?          Passungswert und der eine Satz dazu
 *   4. Was tue ich jetzt?        Wählen, mit Nina durchgehen, Original
 *
 * Erst danach kommt, was die Entscheidung begründet: die
 * Entscheidungsvorlage, Warnzeichen, die aufgeschlüsselte Passung, die
 * Anforderungen und der Arbeitsalltag. Vorher stand die
 * Entscheidungsvorlage ganz oben und das Bild zwei Bildschirme weiter
 * unten — die Begründung also vor dem, was sie begründet.
 *
 * Was hier bewusst NICHT steht: die volle Stellenbeschreibung als
 * Textwand. Sie ist einen Klick entfernt — wer sie liest, hat sich
 * schon entschieden, dass die Stelle interessant ist. Deshalb lädt die
 * Ranglistenabfrage sie auch gar nicht erst (siehe lib/matching.ts).
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
  brief,
  wohnort,
  wunschgehalt,
  maxPendelzeit,
  zukunft,
  ninaDaten,
  gehaltsangaben,
  lebenshaltung,
}: {
  scored: ScoredJob;
  t: Translator["t"];
  saved: boolean;
  assistantName: string;
  labels: { save: string; saved: string };
  /** Die Entscheidungsvorlage. Fehlt sie, bleibt der Rest wie er ist. */
  brief?: DecisionBrief;
  /**
   * Für die beiden Rechner.
   *
   * Sie standen bisher nur auf der eigenen Stellenseite. Wer die Liste
   * benutzt, musste für „was bleibt netto" und „wie lange fahre ich"
   * die Seite wechseln — also genau dann, wenn er gerade vergleicht.
   */
  wohnort?: string | null;
  /** Die eigene Gehaltsuntergrenze — Massstab für die Farbe. */
  wunschgehalt?: number | null;
  /** Die eigene Pendelzeit-Obergrenze in Minuten. */
  maxPendelzeit?: number | null;
  /**
   * Wie es dem Beruf geht.
   *
   * Nur gebraucht, wenn keine Passung berechenbar ist — dann sagt
   * Nina etwas über den Beruf statt über den Stand des Profils.
   */
  zukunft?: import("@/lib/jobs/zukunft").Zukunftsangabe | null;
  /**
   * Ninas Lesart — dieselben Zahlen wie im Panel rechts.
   *
   * Optional, weil `JobDetailPanel` auch ohne sie funktionieren muss:
   * Ohne berechnete Passung gibt es nichts zu deuten, und dann steht
   * die Werteaufschlüsselung dort, wo sonst die Analyse steht.
   */
  ninaDaten?: WorkspaceDaten | null;
  gehaltsangaben?: Gehaltsangaben;
  lebenshaltung?: Lebenshaltung;
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

  return (
    /* Weniger Innenabstand: 28 Pixel Rand und 28 Pixel zwischen den
       Abschnitten waren zusammen mehr Luft als Inhalt. 24 und 24
       lassen zwei Abschnitte mehr ins Bild, ohne dass es eng wird. */
    <article className="grid gap-6 p-4 lg:p-6">
      {/*
       * Derselbe Kopf wie auf der eigenen Seite — ein Bauteil, zwei
       * Routen. Die Reihenfolge steht in JobKopf.tsx und nur dort.
       */}
      <JobKopf
        titelAls="h2"
        assistantName={assistantName}
        daten={{
          job,
          firma: scored.firma ?? null,
          quelle: scored.source?.displayName ?? null,
          herkunft: scored.source ? herkunftAusArt(scored.source.kind) : null,
          bedingungen: scored.constraints,
          veraltet: listingConfidence.possiblyStale,
          score: fit.score,
          bandText,
          /*
           * Die Transparenz der ANZEIGE — nicht die Bedingungen.
           *
           * Hier stand `jobQuality.score`. Der misst, was die Stelle
           * BIETET, und enthielt bis heute die Offenheit der Anzeige
           * mit 15 Prozent — zwei Aussagen in einer Zahl unter einer
           * Beschriftung, die nur eine davon nennt.
           *
           * `anzeige.score` misst ausschliesslich, was dasteht: sechs
           * gleich gewichtete Punkte. Er ist immer berechenbar, denn
           * Fehlen ist selbst die Antwort.
           */
          qualitaet: scored.anzeige.score,
          /* Die Arbeitsbedingungen — was die Stelle bietet. `null`,
             wenn zu wenig beurteilbar ist; das ist häufig, weil vier
             der sieben Dimensionen aus Mitarbeiterstimmen stammen. */
          bedingungenWert: jobQuality.insufficientData ? null : jobQuality.score,
          /* Die dritte Leiste: wie belastbar die Einschätzung ist.
             Sie stand weiter unten als drei Punkte — an drei Orten in
             drei Formen, was man nicht vergleichen kann. */
          sicherheit: confidence.level,
          sicherheitWert: confidence.score,
          /* Massstab für die Farbe des Gehaltskastens. Ohne
             hinterlegte Untergrenze bleibt er neutral. */
          wunschgehalt: wunschgehalt ?? null,
          grund: fit.topReason || null,
          vorbehalt: fit.topReservation || null,
          empfehlung: brief
            ? {
                text: recommendationLabel(brief.recommendation),
                ton:
                  brief.recommendation === "apply_now"
                    ? "positive"
                    : brief.recommendation === "deprioritise"
                      ? "critical"
                      : "caution",
              }
            : null,
          gesperrt: constraints.overall === "blocked",
        }}
        aktionen={
          <>
            {/*
              Führt zu Nina, statt zu einem Anker weiter unten.
              
              Vorher sprang der Knopf zu einem Block in derselben
              Spalte. Seit Nina nur noch einen Einstieg hat — die Blase
              unten rechts —, ist der Sprung ins Leere gegangen: Der
              Block dort ist keine Eingabe mehr.
              
              Jetzt öffnet er die Blase und lässt sie kurz blinken,
              damit man sieht, wohin man geschickt wurde.
            */}
            <NinaFragenKnopf assistantName={assistantName} />
            {/*
              „Vollständige Analyse" stand ganz unten, mit der
              Begründung, sie vertiefe, was darüber steht. Nach acht
              Abschnitten kam sie aber bei niemandem mehr an — und wer
              sie sucht, sucht sie oben bei den anderen Handlungen.
            */}
            <Button asChild variant="secondary" size="sm">
              <Link href={`/app/jobs/${job.id}`}>Vollständige Analyse</Link>
            </Button>
            <SaveJobButton
              jobId={job.id}
              initiallySaved={saved}
              labels={{ save: labels.save, saved: labels.saved }}
            />
          </>
        }
      />

      <Separator soft />

      {/*
       * Ninas Analyse statt der Werteaufschlüsselung.
       *
       * Hier stand `Passungsbefund` — vier Teilwerte mit Balken. Der
       * Baustein ist gut und bleibt auf der Einzelseite der Stelle,
       * wo Platz für die Aufschlüsselung ist.
       *
       * In der Spaltenansicht ist er die falsche erste Auskunft:
       * Zahlen beantworten nicht die Frage, mit der jemand die Seite
       * öffnet. Die lautet „was heisst das für mich" — und darauf
       * antworten ein Satz und drei kurze Listen besser als vier
       * Balken. Wer die Aufschlüsselung will, findet sie rechts unter
       * „Warum passt der Job zu mir".
       */}
      {ninaDaten ? (
        <NinaAnalyse
          daten={ninaDaten}
          assistantName={assistantName}
          vollstaendigHref={`/app/jobs/${job.id}`}
          /*
           * Dieselben Zahlen wie in den Leisten oben — die Analyse
           * erklärt sie, sie rechnet sie nicht nach.
           *
           * ══════════════════════════════════════════════════════
           * Was hier falsch war
           * ══════════════════════════════════════════════════════
           *
           * Es waren NICHT dieselben Zahlen. Die Leisten oben wurden
           * korrigiert — `qualitaet` liest dort seither
           * `anzeige.score` —, die Analyse darunter nicht. Sie bekam
           * weiter `jobQuality.score`.
           *
           * Und `bedingungen` bekam denselben Wert noch einmal: die
           * Anzeigenqualität, ausgegeben als Arbeitsbedingungen.
           *
           * Das Ergebnis war das Schlimmste, was diese Seite tun
           * kann: Über einer Zahl stand eine Erklärung, die eine
           * andere Zahl meinte — und benannte sie mit einem dritten
           * Begriff. Wer das liest, hält die Erklärung für falsch
           * und danach die Zahl auch.
           *
           * Die Werte kommen jetzt aus denselben Ausdrücken wie die
           * Leisten. Zwei Stellen, ein Wert — und wenn sich der eine
           * ändert, fällt der andere auf.
           */
          zukunft={
            zukunft
              ? {
                  sicherheit: zukunft.bild.sicherheit,
                  berufsgruppen: zukunft.bild.berufsgruppen,
                  nachfrage: zukunft.nachfrage,
                  automatisierung: zukunft.automatisierung,
                  konfidenz: zukunft.konfidenz,
                  herkunft: zukunft.herkunft,
                }
              : null
          }
          werte={{
            /* Leiste „Passung“ */
            matching: fit.score,
            /* Leiste „Transparenz der Anzeige“ — was dasteht. */
            qualitaet: scored.anzeige.score,
            /* Leiste „Sicherheit der Einschätzung“ */
            sicherheit: confidence.score,
            /* Leiste „Arbeitsbedingungen“ — was die Stelle bietet. */
            bedingungen: jobQuality.insufficientData ? null : jobQuality.score,
          }}
        />
      ) : (
        <Passungsbefund fit={fit} confidence={confidence} bedingungen={constraints} />
      )}

      <Separator soft />

        {/*
          Die Entscheidungsvorlage.
          
          Sie steht vor allen Werten, weil sie die Frage beantwortet,
          die die Person tatsächlich hat: soll ich mich hier bewerben?
          Fünf getrennte Zahlen darunter sind vollständig und trotzdem
          keine Hilfe.
        */}
        {brief && (
          <div className="grid gap-3.5 rounded-(--radius-md) border border-line-2 bg-inset px-4 py-3.5">
            {/*
             * Empfehlung und Kernaussage stehen jetzt oben im Kopf.
             *
             * Sie hier ein zweites Mal zu zeigen war keine Betonung,
             * sondern eine Dopplung: dieselbe Auszeichnung und derselbe
             * Satz, zwei Handbreit auseinander. Eine E2E-Prüfung hat es
             * gefunden, weil ihr Selektor plötzlich zwei Treffer hatte
             * — was für einen Menschen heisst: er liest dasselbe zweimal
             * und fragt sich, ob es einen Unterschied gibt.
             *
             * Was hier bleibt, ist das, was oben NICHT steht: der
             * Aufwand und die drei Spalten darunter.
             */}
            {brief.effort.level !== "unbekannt" && (
              <p className="abschnitts-titel text-ink-3">
                Aufwand {brief.effort.level} · {brief.effort.minutesMin}–{brief.effort.minutesMax} Min.
              </p>
            )}

            <dl className="grid gap-3 sm:grid-cols-3">
              {[
                ["Dafür spricht", brief.reasons, "positive"] as const,
                ["Möglicher Haken", brief.catches, "caution"] as const,
                ["Noch unklar", brief.unknowns, "neutral"] as const,
              ].map(([titel, eintraege]) =>
                eintraege.length === 0 ? null : (
                  <div key={titel} className="grid gap-1.5">
                    <dt className="abschnitts-titel text-ink-3">
                      {titel}
                    </dt>
                    <dd>
                      <ul className="grid gap-1.5">
                        {eintraege.map((e) => (
                          <li key={e} className="text-xs leading-relaxed text-ink-2">
                            {e}
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ),
              )}
            </dl>

            {brief.preflight.questions.length > 0 && (
              <details className="group">
                <summary className="inline-flex min-h-6 cursor-pointer items-center text-xs text-accent-text underline underline-offset-[3px]">
                  {brief.preflight.questions.length} Fragen, die du vorher stellen kannst
                </summary>
                <ul className="mt-2.5 grid gap-1.5">
                  {brief.preflight.questions.map((q) => (
                    <li key={q} className="text-xs leading-relaxed text-ink-2">
                      {q}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <p className="text-2xs leading-relaxed text-ink-3">
              {brief.requirements.summary} Der Aufwand ist{" "}
              {brief.effort.source === "provider_data" ? "vom Anbieter gemeldet" : "aus dem Bewerbungsweg geschätzt"}.
            </p>
          </div>
        )}

        {/* Warnzeichen. Steht weit oben, weil ein Hinweis nach dem
            dritten Absatz keiner mehr ist — und weil es hier nicht um
            Passung geht, sondern um Schaden. */}
        {scored.scam?.level === "additional_verification_recommended" && (
          <div
            role="note"
            className="grid gap-3 rounded-(--radius-md) border border-caution/30 bg-caution-soft px-4 py-3.5"
          >
            <p className="flex items-start gap-2 text-sm font-medium text-caution">
              <ShieldAlert aria-hidden className="mt-px size-4 shrink-0" strokeWidth={2} />
              {scored.scam.summary}
            </p>
            <ul className="grid gap-3">
              {scored.scam.signals
                .filter((signal) => signal.severity !== "hinweis")
                .map((signal) => (
                  <li key={signal.key} className="grid gap-1">
                    <span className="text-sm text-ink">{signal.label}</span>
                    {/* Das Zitat aus der Anzeige. Ohne Fundstelle kann
                        die Person den Hinweis nicht prüfen — und ein
                        Hinweis, den man nicht prüfen kann, ist eine
                        Behauptung. */}
                    <span className="border-l-2 border-line-2 pl-2.5 text-xs italic leading-relaxed text-ink-3">
                      {signal.evidence}
                    </span>
                    <span className="text-xs leading-relaxed text-ink-2">{signal.advice}</span>
                  </li>
                ))}
            </ul>
            <p className="text-2xs leading-relaxed text-ink-3">
              Das ist kein Urteil über diesen Arbeitgeber. Es steht hier, was in der Anzeige
              steht — prüfen musst du selbst.
            </p>
          </div>
        )}

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


      {/*
        Der Abschnitt „Passung" ist entfallen — und mit ihm seine
        Trennlinie.
        
        Er enthielt zuletzt nur noch Kommentare: Die Passung steht im
        Kopf, ihre Erklärung in der Nina-Analyse, die Einzelachsen auf
        der Einzelseite. Ein leerer Abschnitt nimmt keinen Platz, seine
        Trennlinie schon — und drei Linien kurz hintereinander sahen aus
        wie eine eigene Gestaltung.
        
        Der Hinweis auf ein verletztes Ausschlusskriterium bleibt. Er
        ist kein Abschnitt, sondern eine Warnung, und steht deshalb
        ohne Überschrift und ohne eigene Linie.
      */}
        {constraints.overall === "blocked" && (
          <div
            role="note"
            className="grid gap-2 rounded-(--radius-md) border border-critical/30 bg-critical-soft px-4 py-3.5"
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

      {/* ── Die Rolle ────────────────────────────────────── */}
      <section aria-labelledby="rolle" className="grid gap-3.5">
        <h3 id="rolle" className="abschnitts-titel text-ink-3">
          Der Arbeitsalltag
        </h3>
        {/*
          Alle Aufgaben, nicht sechs.
          
          Hier stand `.slice(0, 6)` ohne jeden Hinweis darauf, dass
          etwas fehlt. Eine Stelle mit neun Aufgaben sah damit aus wie
          eine mit sechs — und wer sich danach richtet, richtet sich
          nach einer Auswahl, die ein Deckel getroffen hat und niemand
          sonst.
          
          Wenn eine Anzeige lang ist, ist sie lang. Die Fläche hier
          rollt; ein Deckel spart keinen Platz, er verschweigt Inhalt.
        */}
        {job.coreTasks.length > 0 ? (
          <ul className="grid gap-2">
            {job.coreTasks.map((task) => (
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
        <h3 id="anforderungen" className="abschnitts-titel text-ink-3">
          Anforderungen
        </h3>
        {musts.length === 0 && nices.length === 0 ? (
          <p className="text-sm text-ink-3">Die Anzeige nennt keine ausdrücklichen Anforderungen.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {/*
              Auch hier standen Deckel — fünf Muss und fünf Wunsch.
              
              Bei Anforderungen wiegt das schwerer als bei Aufgaben: Wer
              die sechste Muss-Anforderung nicht sieht, hält sich für
              geeignet und ist es nicht. Das ist keine Kürzung, das ist
              eine falsche Auskunft über die Stelle.
            */}
            <div>
              <p className="text-sm font-medium">{t("jobDetail.mustHave")}</p>
              <ul className="mt-2 grid gap-1.5">
                {musts.map((r) => (
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
                {nices.map((r) => (
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

      {/*
        ── Die beiden Rechner, abgesichert ───────────────────
        
        Was bleibt netto, und wie lange fahre ich. Sie standen einmal
        hier, nahmen aber beim Scheitern die ganze rechte Spalte mit —
        man sah nur noch die Liste links, und nichts sagte, warum.
        
        Jetzt liegt um jeden eine `Fehlergrenze`. Bricht einer, bleibt
        die Stelle lesbar und ein Satz sagt, was fehlt. Dazu je eine
        `Suspense`-Grenze: Der Arbeitsweg fragt beim ersten Mal einen
        Geodienst, und ohne Grenze wartet der ganze Block auf diese
        eine Antwort.
        
        Zwei verschiedene Ausfälle, zwei verschiedene Grenzen —
        `Suspense` fängt Warten, `Fehlergrenze` fängt Werfen. Eine
        allein reicht nicht, und genau daran ist der erste Versuch
        gescheitert.
      */}
      {/*
        Der Block erscheint auch ohne Wohnort.
        
        Vorher stand hier `{wohnort && …}` — und weil nur 88 von 1001
        Konten einen Wohnort hinterlegt haben, war der Routenrechner
        für fast alle schlicht nicht da. Kein Hinweis, keine Lücke,
        nichts: Er sah aus, als gäbe es ihn nicht.
        
        Eine fehlende Angabe ist aber kein Grund zu schweigen, sondern
        einer zu fragen. Der Satz sagt, was fehlt und wo man es
        einträgt — und danach rechnet er.
      */}
      <section aria-labelledby="arbeitsweg-panel" className="grid gap-3.5">
          {/*
            Die Überschrift steht im `Arbeitswegblock`, nicht hier.
            
            Sie trägt ein Warnzeichen, wenn der Weg über der eigenen
            Grenze liegt — und die Fahrzeit kennt nur der Block, weil
            er sie berechnet. Sie hier ein zweites Mal auszurechnen,
            nur um ein Dreieck zu zeigen, hiesse eine Routenabfrage
            für ein Symbol.
            
            Ohne Wohnort steht die Überschrift weiterhin hier: Dann
            gibt es keinen Block, aber sehr wohl etwas zu sagen.
          */}
          {!wohnort && (
            <h3 id="arbeitsweg-panel" className="abschnitts-titel text-ink-3">
              Dein Arbeitsweg
            </h3>
          )}
          {!wohnort ? (
            <p className="text-sm leading-relaxed text-ink-2">
              Für die Fahrzeit brauche ich deinen Wohnort.{" "}
              <Link
                href="/app/settings/language-region"
                className="text-accent-text underline underline-offset-[3px]"
              >
                Einmal eintragen
              </Link>{" "}
              — danach steht er bei jeder Stelle.
            </p>
          ) : (
          <Fehlergrenze
            name="Arbeitsweg"
            ersatz={
              <p className="text-sm text-ink-3">
                Die Fahrzeit lässt sich gerade nicht berechnen. Die Angaben zur Stelle stehen
                unverändert daneben.
              </p>
            }
          >
            <Suspense fallback={<p className="text-sm text-ink-3">Der Arbeitsweg wird berechnet …</p>}>
              <Arbeitswegblock
                job={job}
                wohnort={wohnort}
                /* Massstab für die Farbe der Fahrzeiten. Ohne
                   hinterlegte Grenze bleiben sie neutral — das
                   entscheidet der Baustein selbst. */
                maxPendelzeit={maxPendelzeit ?? null}
              />
            </Suspense>
          </Fehlergrenze>
          )}
        </section>

      {(job.salary.min !== null || job.salary.max !== null) && (
        <section
          id="gehaltsrechner"
          aria-labelledby="netto-panel"
          /*
           * Das Sprungziel hängt am ABSCHNITT, nicht am Rechner.
           *
           * Vorher trug der Rechner selbst die Kennung — und der wird
           * nur gerendert, wenn Steuerangaben UND Lebenshaltungskosten
           * hinterlegt sind. Wer beides noch nicht eingetragen hat,
           * bekam einen Link „Mit deinen Angaben rechnen", der ins
           * Leere zeigte: Der Browser fand die Kennung nicht und tat
           * gar nichts.
           *
           * Jetzt gibt es den Abschnitt, sobald ein Gehalt dasteht.
           * Fehlen die Angaben, führt der Link zu der Stelle, an der
           * steht, welche fehlen — das ist die richtige Antwort auf
           * „ich will mit meinen Angaben rechnen".
           */
          className="grid scroll-mt-4 gap-3.5"
        >
          <h3 id="netto-panel" className="abschnitts-titel text-ink-3">
            Was bleibt dir netto
          </h3>

          {!(gehaltsangaben && lebenshaltung) && (
            <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
              Für die Rechnung mit deinen Angaben brauche ich deine Steuerangaben und deine
              monatlichen Fixkosten.{" "}
              <Link
                href="/app/settings/gehalt"
                className="text-accent-text underline underline-offset-[3px]"
              >
                Angaben hinterlegen
              </Link>
            </p>
          )}

          {gehaltsangaben && lebenshaltung && (<>
          <Fehlergrenze
            name="Nettorechner"
            ersatz={
              <p className="text-sm text-ink-3">
                Die Nettorechnung lässt sich gerade nicht anzeigen. Das Bruttogehalt steht oben.
              </p>
            }
          >
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
          </Fehlergrenze>
          </>)}
        </section>
      )}

      {/* ── Rezensionen ──────────────────────────────────── */}
      <section aria-labelledby="rezensionen" className="grid gap-2">
        <h3 id="rezensionen" className="abschnitts-titel text-ink-3">
          Rezensionen und Erfahrungen
        </h3>
        {/*
          Hier stand die Jobqualität als Zahl. Sie ist jetzt oben im
          Kopf als Leiste — an der Stelle, an der man sie mit der
          Passung vergleicht.
          
          An ihrer Stelle das, wonach man an dieser Stelle sucht:
          Erfahrungen anderer mit diesem Arbeitgeber.
          
          ── Warum hier nichts steht ─────────────────────────
          
          Die Tabellen `review_aggregates` und `review_themes` gibt es,
          sie sind leer — null Zeilen. Es ist keine Bewertungsquelle
          angebunden.
          
          Das auszusprechen ist die einzige zulässige Anzeige. Sterne
          zu zeigen, die niemand vergeben hat, oder aus der
          Anzeigenqualität eine Arbeitgeberbewertung zu machen, wäre
          eine Erfindung über ein echtes Unternehmen.
        */}
        <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-3">
          Zu {job.companyName} liegen mir keine Bewertungen vor. Es ist noch keine Bewertungsquelle
          angebunden — ich zeige hier lieber nichts als Sterne, die niemand vergeben hat.
        </p>
      </section>

      <Separator soft />

      {/* ── Nina ─────────────────────────────────────────── */}
      {/* Die Antwort erscheint hier, nicht auf einer anderen Seite.
          Die Stelle bleibt sichtbar (§13.3).

          `scroll-mt-6`, damit der Block beim Sprung aus dem Kopf nicht
          bündig an der Oberkante klebt — die Überschrift darüber soll
          mitkommen, sonst weiss niemand, wo er gelandet ist. */}
      <div id={`nina-zu-${job.id}`} className="scroll-mt-6">
        <BerufsFragen
          titel={job.title}
          assistantName={assistantName}
          lage={{
            hatAufgaben: (job.coreTasks?.length ?? 0) > 0,
            hatGehalt: job.salary.min !== null || job.salary.max !== null,
            hatAnforderungen: scored.requirements.length > 0,
            /* `shiftWork` ist dreiwertig: true, false oder unbekannt.
               Unbekannt heisst NICHT Schichtarbeit — sonst fragt Nina
               nach etwas, das die Anzeige nie erwähnt hat. */
            schichtarbeit: job.shiftWork === true,
            reiseanteil: job.travelPercent,
            arbeitsmodell: job.workModel,
            unternehmen: job.companyName,
          }}
        />
      </div>

    </article>
  );
}
