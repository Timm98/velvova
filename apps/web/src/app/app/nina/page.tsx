import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { getPageContext } from "@/lib/locale";
import { loadInterview } from "@/lib/interview";
import { Badge, Card, Disclosure } from "@/components/ui";
import { NotConnected } from "@/components/ui/states";
import { cn } from "@/lib/cn";
import { InterviewChat } from "./InterviewChat";

export const metadata: Metadata = { title: "Gespräch" };
export const dynamic = "force-dynamic";

/**
 * Das Karrieregespräch.
 *
 * Nina steht im Mittelpunkt, nicht eine Formularwand. Eine Hauptfrage,
 * daneben sichtbar, was bisher verstanden wurde und was noch Vermutung
 * ist.
 *
 * Der Fortschritt zählt Themen, keine Prozente. Eine Prozentzahl wäre
 * hier scheingenau — sie würde eine Messung behaupten, die es nicht
 * gibt, und sie erzeugt Druck, wo keiner hingehört.
 */
export default async function NinaPage() {
  const { t, brand } = await getPageContext();
  const view = await loadInterview();

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
      {/* ══ Gespräch ═══════════════════════════════════════════ */}
      <div className="grid min-w-0 content-start gap-6">
        <header className="grid gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{t("interview.title")}</h1>
            {view.providerIsMock && <Badge tone="caution">Demo-Anbieter</Badge>}
          </div>

          <div>
            <p className="text-sm text-ink-2">
              {t("interview.progress", {
                done: view.progress.understood,
                total: view.progress.total,
              })}
              {view.progress.minimumProfileReached && (
                <span className="font-medium text-positive"> · Mindestprofil erreicht</span>
              )}
            </p>

            <ol aria-label="Themen" className="mt-3 flex flex-wrap gap-1.5">
              {view.progress.topics.map((topic) => (
                <li
                  key={topic.stage}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[--radius-full] border px-2.5 py-1 text-xs",
                    topic.state === "done"
                      ? "border-positive/30 bg-positive-soft text-positive"
                      : topic.state === "skipped"
                        ? "border-line bg-inset text-ink-3"
                        : "border-line-2 text-ink-2",
                  )}
                >
                  {topic.state === "done" && (
                    <Check aria-hidden className="size-3" strokeWidth={2.6} />
                  )}
                  {topic.label}
                  {topic.state === "skipped" && <span className="sr-only">— übersprungen</span>}
                </li>
              ))}
            </ol>
          </div>
        </header>

        {view.turns.length === 0 && (
          <Card className="border-assistant-border bg-assistant-soft">
            <Badge tone="assistant">
              <Sparkles className="size-3" strokeWidth={2} />
              {brand.assistantName}
            </Badge>
            <p className="mt-4 max-w-[var(--measure)] leading-relaxed">{t("interview.intro")}</p>
          </Card>
        )}

        <InterviewChat
          initialTurns={view.turns}
          step={view.step}
          assistantName={brand.assistantName}
          providerIsMock={view.providerIsMock}
          voiceAvailable={view.voiceAvailable}
          labels={{
            yourAnswer: t("interview.yourAnswer"),
            send: t("interview.send"),
            skipQuestion: t("interview.skipQuestion"),
            whyThisQuestion: t("interview.whyThisQuestion"),
            voiceMode: t("interview.voiceMode"),
            textMode: t("interview.textMode"),
            voiceUnavailable: t("interview.voiceUnavailable"),
            listening: t("interview.listening"),
            pause: t("interview.pause"),
            resume: t("interview.resume"),
            interrupt: t("interview.interrupt"),
            liveTranscript: t("interview.liveTranscript"),
            thinking: t("interview.thinking"),
            pauseSession: t("interview.pauseSession"),
            resumeLater: t("interview.resumeLater"),
          }}
        />
      </div>

      {/* ══ Was bisher verstanden wurde ════════════════════════ */}
      <aside className="grid min-w-0 content-start gap-4 lg:sticky lg:top-[76px] lg:self-start">
        {view.providerIsMock && (
          <NotConnected
            what="KI-Anbieter"
            detail="Es läuft der lokale Demo-Anbieter. Seine Antworten sind Beispiele ohne inhaltliche Aussage. Deine Angaben werden trotzdem richtig gespeichert und ausgewertet — die Bewertungslogik braucht kein Sprachmodell."
          />
        )}

        <Card className="grid gap-3.5">
          <h2 className="text-base font-semibold">{t("interview.recognisedSoFar")}</h2>
          {view.confirmedFacts.length === 0 ? (
            <p className="text-sm leading-relaxed text-ink-3">
              Noch nichts bestätigt. Deine Antworten warten im Profil auf deine Bestätigung.
            </p>
          ) : (
            <ul className="grid gap-2.5">
              {view.confirmedFacts.slice(0, 6).map((f) => (
                <li key={f.id} className="flex gap-2.5 text-sm leading-relaxed">
                  <Check
                    aria-hidden
                    className="mt-[3px] size-3.5 shrink-0 text-positive"
                    strokeWidth={2.4}
                  />
                  <span className="text-ink-2">{f.statement}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {view.openHypotheses.length > 0 && (
          <Card className="grid gap-3.5">
            <div>
              <h2 className="text-base font-semibold">{t("interview.openHypotheses")}</h2>
              <p className="mt-1 text-xs leading-relaxed text-ink-3">
                Nichts davon zählt, bevor du es bestätigt hast.
              </p>
            </div>
            <ul className="grid gap-2.5">
              {view.openHypotheses.slice(0, 6).map((h) => (
                <li key={h.id} className="text-sm leading-relaxed text-ink-2">
                  {h.statement.length > 120 ? `${h.statement.slice(0, 120)}…` : h.statement}
                </li>
              ))}
            </ul>
            <Link
              href="/app/career"
              className="inline-flex items-center gap-1.5 text-sm text-accent-text underline underline-offset-[3px]"
            >
              Im Profil prüfen
              <ArrowRight className="size-3.5" strokeWidth={1.9} />
            </Link>
          </Card>
        )}

        <Disclosure summary="Was passiert mit meinen Antworten?">
          <div className="grid gap-3 text-sm leading-relaxed text-ink-2">
            <p>
              Jede Antwort wird als <span className="font-medium text-ink">unbestätigte</span>{" "}
              Angabe gespeichert. Sie fließt erst in Empfehlungen ein, wenn du sie im Profil
              bestätigt hast.
            </p>
            <p>
              Du kannst jede Angabe bearbeiten, ablehnen oder löschen — auch später. Wird ein Beleg
              gelöscht, verlieren die Aussagen, die darauf beruhten, ihre Grundlage.
            </p>
            <p>
              <Link
                href="/app/settings/privacy"
                className="text-accent-text underline underline-offset-[3px]"
              >
                Zum Privacy Center
              </Link>
            </p>
          </div>
        </Disclosure>
      </aside>
    </div>
  );
}
