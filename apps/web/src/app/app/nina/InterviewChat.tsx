"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { pauseSession, skipQuestion, submitAnswer } from "@/lib/interview";
import { ArrowRight, Keyboard, Mic, PauseCircle, SendHorizonal } from "lucide-react";
import { Badge, Button, Card, Disclosure, Textarea } from "@/components/ui";
import { cn } from "@/lib/cn";
import { VoicePanel } from "./VoicePanel";

/**
 * Das Gespräch.
 *
 * Genau eine Hauptfrage sichtbar. Text- und Sprachmodus jederzeit
 * wechselbar. Jede Frage kann übersprungen werden - das steht direkt
 * daneben und nicht in einem Menü.
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

  // Die letzten acht Beiträge stehen offen, alles Frühere eingeklappt.
  const RECENT = 8;
  const earlier = initialTurns.slice(0, Math.max(0, initialTurns.length - RECENT));
  const recent = initialTurns.slice(Math.max(0, initialTurns.length - RECENT));

  return (
    <div className="grid gap-6">
      {/* ── Verlauf ─────────────────────────────────────────── */}
      {/*
        Nur die letzten Züge stehen offen. Ein Gespräch über zwölf
        Themen wird lang, und wer zurückkommt, will die aktuelle Frage
        sehen — nicht erst an vierzig Beiträgen vorbeirollen. Das
        Frühere bleibt vollständig erreichbar, nur eingeklappt.
      */}
      {earlier.length > 0 && (
        <Disclosure summary={`${earlier.length} frühere Beiträge anzeigen`}>
          <ol aria-label="Früherer Gesprächsverlauf" className="grid gap-4">
            {earlier.map((turn) => (
              <TurnBubble key={turn.id} turn={turn} assistantName={assistantName} />
            ))}
          </ol>
        </Disclosure>
      )}

      {recent.length > 0 && (
        <ol aria-label="Bisheriges Gespräch" className="grid gap-4">
          {recent.map((turn) => (
            <TurnBubble key={turn.id} turn={turn} assistantName={assistantName} />
          ))}
        </ol>
      )}
      <div ref={endRef} />

      {/* ── Aktuelle Frage ──────────────────────────────────── */}
      <Card className="grid gap-5 border-assistant-border">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge tone="assistant">{step.stageLabel}</Badge>
          {providerIsMock && <Badge tone="caution">Demo</Badge>}
        </div>

        {/* Genau eine Hauptfrage. Alles andere ist Beiwerk. */}
        <p aria-live="polite" className="max-w-[var(--measure)] text-lg leading-relaxed">
          {step.text}
        </p>

        <div>
          <button
            type="button"
            onClick={() => setShowPurpose((v) => !v)}
            aria-expanded={showPurpose}
            className="inline-flex min-h-6 items-center text-sm text-ink-2 underline underline-offset-[3px] transition-colors hover:text-ink"
          >
            {labels.whyThisQuestion}
          </button>
          {showPurpose && (
            <p className="mt-2 max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">
              {step.purpose}
            </p>
          )}
        </div>

        {!isComplete && (
          <>
            <div
              role="group"
              aria-label="Eingabeart"
              className="inline-flex gap-1 self-start rounded-[--radius-md] border border-line-2 bg-sunken p-1"
            >
              {(
                [
                  { value: "text" as const, label: labels.textMode, Icon: Keyboard },
                  { value: "voice" as const, label: labels.voiceMode, Icon: Mic },
                ]
              ).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  aria-pressed={mode === value}
                  className={cn(
                    "flex min-h-9 items-center gap-2 rounded-[--radius-sm] px-3.5 text-sm transition-colors",
                    mode === value
                      ? "bg-raised font-medium text-ink shadow-xs"
                      : "text-ink-2 hover:text-ink",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.9} />
                  {label}
                </button>
              ))}
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

            <div className="grid gap-3">
              <label htmlFor="answer" className="sr-only">
                {labels.yourAnswer}
              </label>
              <Textarea
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
                className="min-h-[104px]"
              />

              {error && (
                <p id="answer-error" role="alert" className="text-sm text-critical">
                  {error}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="primary" onClick={() => send(answer)} disabled={pending}>
                  {pending ? labels.thinking : labels.send}
                  {!pending && <SendHorizonal className="size-4" strokeWidth={1.9} />}
                </Button>

                {step.canSkip && (
                  <Button type="button" variant="ghost" onClick={skip} disabled={pending}>
                    {labels.skipQuestion}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  onClick={pause}
                  disabled={pending}
                  className="ml-auto"
                >
                  <PauseCircle className="size-4" strokeWidth={1.9} />
                  {labels.pauseSession}
                </Button>
              </div>

              <p className="text-xs leading-relaxed text-ink-3">{labels.resumeLater}</p>
            </div>
          </>
        )}

        {isComplete && (
          <Button asChild variant="primary" className="self-start">
            <a href="/app/profile">
              Profil ansehen und bestätigen
              <ArrowRight className="size-4" strokeWidth={1.9} />
            </a>
          </Button>
        )}
      </Card>
    </div>
  );
}

/** Ein einzelner Beitrag im Gespräch. */
function TurnBubble({
  turn,
  assistantName,
}: {
  turn: Turn;
  assistantName: string;
}) {
  return (
    <li className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(100%,56ch)] whitespace-pre-wrap rounded-[--radius-lg] px-4 py-3 leading-relaxed",
          turn.role === "user" && "bg-inset",
          turn.role === "assistant" && "border border-assistant-border bg-assistant-soft",
          turn.role === "system" && "border border-dashed border-line-2 text-xs text-ink-3",
        )}
      >
        {turn.role === "assistant" && (
          <span className="mb-1 block text-xs font-medium text-assistant-text">
            {assistantName}
          </span>
        )}
        {turn.content}
      </div>
    </li>
  );
}
