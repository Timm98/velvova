import type { Metadata } from "next";
import Link from "next/link";
import { getPageContext } from "@/lib/locale";
import { loadInterview } from "@/lib/interview";
import { InterviewChat } from "./InterviewChat";
import { Badge, Card, Disclosure, NotConnected, Stack } from "@/components/ui";

export const metadata: Metadata = { title: "Gespräch" };
export const dynamic = "force-dynamic";

/**
 * Das Karrieregespräch.
 *
 * Nina steht im Mittelpunkt, nicht eine Formularwand. Eine Hauptfrage,
 * daneben sichtbar, was bisher verstanden wurde und was noch Vermutung
 * ist. Der Fortschritt zählt Themen, keine Prozente - eine Prozentzahl
 * wäre hier scheingenau.
 */
export default async function NinaPage() {
  const { t, brand } = await getPageContext();
  const view = await loadInterview();

  return (
    <div style={{ display: "grid", gap: "var(--space-6)", gridTemplateColumns: "minmax(0, 1fr)" }}>
      <div className="nina-grid">
        {/* --- Gespräch --- */}
        <div style={{ display: "grid", gap: "var(--space-5)", alignContent: "start", minWidth: 0 }}>
          <header style={{ display: "grid", gap: "var(--space-3)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
              <h1 style={{ fontSize: "var(--text-xl)" }}>{t("interview.title")}</h1>
              {view.providerIsMock && <Badge tone="caution">Demo-Anbieter</Badge>}
            </div>

            {/* Fortschritt als Themen, nicht als Prozentzahl */}
            <div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                {t("interview.progress", { done: view.progress.understood, total: view.progress.total })}
                {view.progress.minimumProfileReached && (
                  <span style={{ color: "var(--positive)" }}> · Mindestprofil erreicht</span>
                )}
              </p>
              <ol
                aria-label="Themen"
                style={{
                  listStyle: "none",
                  display: "flex",
                  gap: 4,
                  marginTop: "var(--space-2)",
                  flexWrap: "wrap",
                }}
              >
                {view.progress.topics.map((topic) => (
                  <li
                    key={topic.stage}
                    title={topic.label}
                    style={{
                      fontSize: "var(--text-xs)",
                      padding: "2px var(--space-2)",
                      borderRadius: "var(--radius-full)",
                      border: "1px solid var(--border-subtle)",
                      background:
                        topic.state === "done"
                          ? "var(--positive-subtle)"
                          : topic.state === "skipped"
                            ? "var(--surface-inset)"
                            : "transparent",
                      color:
                        topic.state === "done"
                          ? "var(--positive)"
                          : topic.state === "skipped"
                            ? "var(--text-muted)"
                            : "var(--text-secondary)",
                    }}
                  >
                    {topic.label}
                  </li>
                ))}
              </ol>
            </div>
          </header>

          {view.turns.length === 0 && (
            <Card style={{ background: "var(--assistant-subtle)", borderColor: "var(--assistant-border)" }}>
              <Stack gap={3}>
                <Badge tone="assistant">{brand.assistantName}</Badge>
                <p style={{ maxWidth: "var(--measure)" }}>{t("interview.intro")}</p>
              </Stack>
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

        {/* --- Was bisher verstanden wurde --- */}
        <aside style={{ display: "grid", gap: "var(--space-4)", alignContent: "start", minWidth: 0 }}>
          {view.providerIsMock && (
            <NotConnected
              what="KI-Anbieter"
              detail={
                "Es läuft der lokale Demo-Anbieter. Seine Antworten sind Beispiele ohne inhaltliche " +
                "Aussage. Deine Angaben werden trotzdem richtig gespeichert und ausgewertet - die " +
                "Bewertungslogik braucht kein Sprachmodell."
              }
            />
          )}

          <Card>
            <Stack gap={3}>
              <h2 style={{ fontSize: "var(--text-base)" }}>{t("interview.recognisedSoFar")}</h2>
              {view.confirmedFacts.length === 0 ? (
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>
                  Noch nichts bestätigt. Deine Antworten warten im Profil auf deine Bestätigung.
                </p>
              ) : (
                <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-3)" }}>
                  {view.confirmedFacts.slice(0, 6).map((f) => (
                    <li key={f.id} style={{ fontSize: "var(--text-sm)", display: "flex", gap: "var(--space-2)" }}>
                      <span aria-hidden style={{ color: "var(--positive)" }}>✓</span>
                      <span>{f.statement}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Stack>
          </Card>

          {view.openHypotheses.length > 0 && (
            <Card>
              <Stack gap={3}>
                <h2 style={{ fontSize: "var(--text-base)" }}>{t("interview.openHypotheses")}</h2>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                  Nichts davon zählt, bevor du es bestätigt hast.
                </p>
                <ul style={{ listStyle: "none", display: "grid", gap: "var(--space-3)" }}>
                  {view.openHypotheses.slice(0, 6).map((h) => (
                    <li key={h.id} style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
                      {h.statement.length > 120 ? `${h.statement.slice(0, 120)}…` : h.statement}
                    </li>
                  ))}
                </ul>
                <Link href="/app/profile" style={{ fontSize: "var(--text-sm)", color: "var(--accent-text)" }}>
                  Im Profil prüfen
                </Link>
              </Stack>
            </Card>
          )}

          <Disclosure summary="Was passiert mit meinen Antworten?">
            <div style={{ display: "grid", gap: "var(--space-3)", fontSize: "var(--text-sm)", color: "var(--text-secondary)" }}>
              <p>
                Jede Antwort wird als <strong>unbestätigte</strong> Angabe gespeichert. Sie fliesst
                erst in Empfehlungen ein, wenn du sie im Profil bestätigt hast.
              </p>
              <p>
                Du kannst jede Angabe bearbeiten, ablehnen oder löschen - auch später. Wird ein
                Beleg gelöscht, verlieren die Aussagen, die darauf beruhten, ihre Grundlage.
              </p>
              <p>
                <Link href="/app/settings" style={{ color: "var(--accent-text)" }}>
                  Zum Privacy Center
                </Link>
              </p>
            </div>
          </Disclosure>
        </aside>
      </div>

      <style>{`
        .nina-grid { display: grid; gap: var(--space-6); grid-template-columns: minmax(0, 1fr); }
        @media (min-width: 1024px) {
          .nina-grid { grid-template-columns: minmax(0, 1fr) 340px; }
        }
      `}</style>
    </div>
  );
}
