"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pauseSession, skipQuestion, submitAnswer } from "@/lib/interview";
import { Badge, buttonStyle, Card, Stack } from "@/components/ui";
import { VoicePanel } from "./VoicePanel";

/**
 * Das Gespraech.
 *
 * Genau eine Hauptfrage sichtbar. Text- und Sprachmodus jederzeit
 * wechselbar. Jede Frage kann uebersprungen werden - das steht direkt
 * daneben und nicht in einem Menue.
 */

type Turn = { id: string; role: "assistant" | "user" | "system"; content: string; questionKey: string | null };

interface Step {
  kind: string;
  stage: string;
  questionKey: string | null;
  text: string;
  stageLabel: string;
  purpose: string;
  canSkip: boolean;
}

type Labels = Record<
  | "yourAnswer" | "send" | "skipQuestion" | "whyThisQuestion" | "voiceMode" | "textMode"
  | "voiceUnavailable" | "listening" | "pause" | "resume" | "interrupt" | "liveTranscript"
  | "thinking" | "pauseSession" | "resumeLater",
  string
>;

export function InterviewChat({
  initialTurns,
  step,
  assistantName,
  providerIsMock,
  voiceAvailable,
  labels,
}: {
  initialTurns: Turn[];
  step: Step;
  assistantName: string;
  providerIsMock: boolean;
  voiceAvailable: boolean;
  labels: Labels;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"text" | "voice">("text");
  const [showPurpose, setShowPurpose] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [initialTurns.length]);

  function send(text: string) {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      setError("Schreib etwas, bevor du absendest.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitAnswer(trimmed, step.questionKey, step.stage as never);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAnswer("");
      router.refresh();
    });
  }

  function skip() {
    if (!step.questionKey) return;
    startTransition(async () => {
      await skipQuestion(step.questionKey!, step.stage as never);
      router.refresh();
    });
  }

  function pause() {
    startTransition(async () => {
      await pauseSession();
      router.push("/app");
    });
  }

  const isComplete = step.kind === "interview_complete";

  return (
    <Stack gap={5}>
      {/* --- Verlauf --- */}
      {initialTurns.length > 0 && (
        <ol
          aria-label="Bisheriges Gespraech"
          style={{ listStyle: "none", display: "grid", gap: "var(--space-4)" }}
        >
          {initialTurns.map((turn) => (
            <li
              key={turn.id}
              style={{
                display: "flex",
                justifyContent: turn.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "min(100%, 56ch)",
                  padding: "var(--space-3) var(--space-4)",
                  borderRadius: "var(--radius-lg)",
                  background:
                    turn.role === "user"
                      ? "var(--surface-inset)"
                      : turn.role === "system"
                        ? "transparent"
                        : "var(--assistant-subtle)",
                  border:
                    turn.role === "system"
                      ? "1px dashed var(--border-default)"
                      : "1px solid var(--border-subtle)",
                  fontSize: turn.role === "system" ? "var(--text-xs)" : "var(--text-base)",
                  color: turn.role === "system" ? "var(--text-muted)" : "var(--text-primary)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {turn.role === "assistant" && (
                  <span
                    style={{
                      display: "block",
                      fontSize: "var(--text-xs)",
                      color: "var(--assistant-text)",
                      marginBottom: 4,
                      fontWeight: 500,
                    }}
                  >
                    {assistantName}
                  </span>
                )}
                {turn.content}
              </div>
            </li>
          ))}
        </ol>
      )}
      <div ref={endRef} />

      {/* --- Aktuelle Frage --- */}
      <Card style={{ borderColor: "var(--assistant-border)" }}>
        <Stack gap={4}>
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", flexWrap: "wrap" }}>
            <Badge tone="assistant">{step.stageLabel}</Badge>
            {providerIsMock && <Badge tone="caution">Demo</Badge>}
          </div>

          <p
            aria-live="polite"
            style={{ fontSize: "var(--text-lg)", lineHeight: 1.5, maxWidth: "var(--measure)" }}
          >
            {step.text}
          </p>

          <div>
            <button
              type="button"
              className="compact"
              onClick={() => setShowPurpose((v) => !v)}
              aria-expanded={showPurpose}
              style={{
                background: "transparent",
                border: "none",
                padding: 0,
                fontSize: "var(--text-sm)",
                color: "var(--text-secondary)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                cursor: "pointer",
              }}
            >
              {labels.whyThisQuestion}
            </button>
            {showPurpose && (
              <p style={{ marginTop: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: "var(--measure)" }}>
                {step.purpose}
              </p>
            )}
          </div>

          {!isComplete && (
            <>
              {/* Moduswechsel */}
              <div role="group" aria-label="Eingabeart" style={{ display: "flex", gap: "var(--space-2)" }}>
                <button
                  type="button"
                  className="compact"
                  onClick={() => setMode("text")}
                  aria-pressed={mode === "text"}
                  style={{
                    ...buttonStyle(mode === "text" ? "secondary" : "quiet"),
                    padding: "var(--space-2) var(--space-4)",
                  }}
                >
                  {labels.textMode}
                </button>
                <button
                  type="button"
                  className="compact"
                  onClick={() => setMode("voice")}
                  aria-pressed={mode === "voice"}
                  style={{
                    ...buttonStyle(mode === "voice" ? "secondary" : "quiet"),
                    padding: "var(--space-2) var(--space-4)",
                  }}
                >
                  {labels.voiceMode}
                </button>
              </div>

              {mode === "voice" ? (
                <VoicePanel
                  serverVoiceAvailable={voiceAvailable}
                  labels={labels}
                  onTranscript={(text) => {
                    setAnswer((prev) => (prev ? `${prev} ${text}` : text));
                    inputRef.current?.focus();
                  }}
                  onSubmit={(text) => send(text)}
                  currentText={answer}
                />
              ) : null}

              <div style={{ display: "grid", gap: "var(--space-3)" }}>
                <label htmlFor="answer" className="sr-only">
                  {labels.yourAnswer}
                </label>
                <textarea
                  id="answer"
                  ref={inputRef}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(answer);
                  }}
                  rows={4}
                  placeholder={labels.yourAnswer}
                  aria-describedby={error ? "answer-error" : undefined}
                  aria-invalid={error ? true : undefined}
                  style={{
                    width: "100%",
                    padding: "var(--space-3) var(--space-4)",
                    background: "var(--surface-raised)",
                    border: `1px solid ${error ? "var(--critical)" : "var(--border-default)"}`,
                    borderRadius: "var(--radius-md)",
                    fontSize: "var(--text-base)",
                    lineHeight: 1.6,
                    resize: "vertical",
                    minHeight: 100,
                  }}
                />

                {error && (
                  <p id="answer-error" role="alert" style={{ fontSize: "var(--text-sm)", color: "var(--critical)" }}>
                    {error}
                  </p>
                )}

                <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => send(answer)}
                    disabled={pending}
                    style={buttonStyle("primary")}
                  >
                    {pending ? labels.thinking : labels.send}
                  </button>

                  {step.canSkip && (
                    <button type="button" onClick={skip} disabled={pending} style={buttonStyle("quiet")}>
                      {labels.skipQuestion}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={pause}
                    disabled={pending}
                    style={{ ...buttonStyle("quiet"), marginLeft: "auto" }}
                  >
                    {labels.pauseSession}
                  </button>
                </div>

                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                  {labels.resumeLater}
                </p>
              </div>
            </>
          )}

          {isComplete && (
            <a href="/app/profile" style={buttonStyle("primary")}>
              Profil ansehen und bestaetigen
            </a>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}
