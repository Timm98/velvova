"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, PauseCircle, X } from "lucide-react";
import { confirmEvidence, rejectEvidence } from "@/lib/profile";
import { pauseSession } from "@/lib/interview";
import { Composer } from "@/components/nina/Composer";
import { NinaSignal } from "@/components/nina/NinaSignal";
import { useNina } from "@/components/nina/NinaProvider";
import { cn } from "@/lib/cn";

/**
 * Das Karrieregespräch.
 *
 * Eine Spalte. Oben wer spricht und wie weit es ist, in der Mitte das
 * Gespräch, unten ein schwebender Composer. Sonst nichts.
 *
 * Was hier bewusst NICHT mehr steht — und warum:
 *
 *   Das rechte Informationspanel. Es zeigte dieselben Angaben, die im
 *   Profil stehen, nur kleiner. Zwei Orte für dieselbe Sache heißt:
 *   einer davon ist irgendwann veraltet.
 *
 *   Die Anbieter-Box. Welches Modell antwortet, ist kein Thema für
 *   jemanden, der über seinen Berufsweg spricht.
 *
 *   Die Themen-Leiste mit zwölf Feldern. Sie machte aus einem Gespräch
 *   ein Formular mit Fortschrittsbalken.
 *
 * Was dazugekommen ist: die offenen Vermutungen stehen INLINE im
 * Gespräch, direkt dort, wo sie entstanden sind, mit „Stimmt“ und
 * „Stimmt nicht“ daneben. Bestätigen ist eine Antwort, keine
 * Verwaltungsaufgabe auf einer anderen Seite.
 */

interface Hypothese {
  id: string;
  statement: string;
}

export function InterviewRoom({
  assistantName,
  openingQuestion,
  hypotheses,
  progress,
  initialMessages,
  conversationId,
  labels,
}: {
  assistantName: string;
  openingQuestion: string;
  hypotheses: Hypothese[];
  progress: { done: number; total: number; minimumReached: boolean };
  initialMessages: { id: string; role: "user" | "assistant"; content: string }[];
  conversationId: string | null;
  labels: { yourAnswer: string; skipQuestion: string; pauseSession: string };
}) {
  const nina = useNina();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erledigt, setErledigt] = useState<Set<string>>(new Set());
  const ende = useRef<HTMLDivElement>(null);

  /*
   * Den gespeicherten Verlauf einmal in den Provider legen.
   *
   * Danach gehört das Gespräch dem Provider — auch wenn die Person auf
   * eine andere Seite wechselt und dort weiterspricht. Der Wächter
   * verhindert, dass ein `router.refresh()` den laufenden Verlauf
   * überschreibt.
   */
  const geladen = useRef(false);
  useEffect(() => {
    if (geladen.current) return;
    geladen.current = true;
    if (initialMessages.length > 0) {
      nina.hydrate(conversationId, initialMessages);
    }
  }, [initialMessages, conversationId, nina]);

  useEffect(() => {
    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ende.current?.scrollIntoView({ behavior: ruhig ? "auto" : "smooth", block: "end" });
  }, [nina.messages]);

  function bewerten(id: string, stimmt: boolean) {
    startTransition(async () => {
      await (stimmt ? confirmEvidence(id) : rejectEvidence(id));
      setErledigt((s) => new Set(s).add(id));
      router.refresh();
    });
  }

  function pausieren() {
    startTransition(async () => {
      await pauseSession();
      router.push("/app");
    });
  }

  const offen = hypotheses.filter((h) => !erledigt.has(h.id));
  const zeigt = nina.messages.length > 0 ? nina.messages : [];

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-[760px] flex-col">
      {/* ── Kopf ──────────────────────────────────────────────── */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3 pb-6">
        <NinaSignal size="lg" state={nina.busy ? "thinking" : "active"} />

        <div className="grid min-w-0 flex-1 gap-1">
          <h1 className="font-display text-xl font-semibold tracking-[-0.02em]">
            {assistantName}
          </h1>
          {/*
           * Der Fortschritt zählt Themen, keine Prozente. Eine
           * Prozentzahl wäre scheingenau — sie würde eine Messung
           * behaupten, die es nicht gibt, und Druck erzeugen, wo keiner
           * hingehört.
           */}
          <div className="flex items-center gap-2.5">
            <div
              role="img"
              aria-label={`${progress.done} von ${progress.total} Themen besprochen`}
              className="flex gap-1"
            >
              {Array.from({ length: progress.total }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 w-4 rounded-full transition-colors duration-(--duration-slow)",
                    i < progress.done ? "bg-accent" : "bg-soft-hover",
                  )}
                />
              ))}
            </div>
            {progress.minimumReached && (
              <span className="text-xs text-positive">Mindestprofil erreicht</span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={pausieren}
          disabled={pending}
          className="inline-flex h-10 items-center gap-2 rounded-(--radius-control) px-4 text-sm text-ink-2 transition-colors hover:bg-soft hover:text-ink"
        >
          <PauseCircle className="size-4" strokeWidth={1.8} />
          {labels.pauseSession}
        </button>
      </header>

      {/* ── Gespräch ──────────────────────────────────────────── */}
      <div className="min-h-0 flex-1">
        {zeigt.length === 0 && (
          <p className="max-w-[var(--measure)] text-lg leading-relaxed text-ink">
            {openingQuestion}
          </p>
        )}

        <ol className="grid gap-6">
          {zeigt.map((m) => (
            <li key={m.id} className={cn("grid", m.role === "user" && "justify-items-end")}>
              {m.role === "user" ? (
                <p className="max-w-[85%] whitespace-pre-wrap rounded-(--radius-lg) rounded-br-md bg-soft px-4 py-3 leading-relaxed">
                  {m.content}
                </p>
              ) : (
                <p className="max-w-[var(--measure)] whitespace-pre-wrap text-[17px] leading-relaxed">
                  {m.content}
                  {m.streaming && (
                    <span
                      aria-hidden
                      className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 bg-accent motion-safe:animate-pulse"
                    />
                  )}
                </p>
              )}
            </li>
          ))}
        </ol>

        {/* ── Was Nina verstanden hat ─────────────────────────── */}
        {offen.length > 0 && (
          <div className="mt-8 grid gap-3">
            <p className="text-sm text-ink-2">
              Das habe ich verstanden. Nichts davon zählt, bevor du es bestätigt hast.
            </p>
            <ul className="grid gap-2">
              {offen.slice(0, 4).map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-(--radius-lg) bg-soft px-4 py-3"
                >
                  <span className="min-w-0 flex-1 text-sm leading-relaxed">{h.statement}</span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => bewerten(h.id, true)}
                      disabled={pending}
                      className="inline-flex h-9 items-center gap-1.5 rounded-(--radius-control) px-3.5 text-sm transition-colors hover:bg-raised"
                    >
                      <Check className="size-4 text-positive" strokeWidth={2.4} />
                      Stimmt
                    </button>
                    <button
                      type="button"
                      onClick={() => bewerten(h.id, false)}
                      disabled={pending}
                      className="inline-flex h-9 items-center gap-1.5 rounded-(--radius-control) px-3.5 text-sm text-ink-2 transition-colors hover:bg-raised"
                    >
                      <X className="size-4" strokeWidth={2.2} />
                      Stimmt nicht
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {nina.error && (
          <p
            role="alert"
            className="mt-6 rounded-(--radius-lg) bg-caution-soft px-4 py-3 text-sm leading-relaxed text-ink-2"
          >
            {nina.error}
          </p>
        )}

        <div ref={ende} className="h-4" />
      </div>

      {/* ── Composer ──────────────────────────────────────────── */}
      {/* Klebt unten, liegt aber im Fluss: eine überlagernde Leiste
          verdeckt sonst das Ende des Gesprächs. */}
      <div className="sticky bottom-0 -mx-1 bg-gradient-to-t from-page via-page to-transparent px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-6">
        <Composer
          onSend={(text, options) => void nina.send(text, options)}
          busy={nina.busy}
          placeholder={labels.yourAnswer}
          autoFocus
        />
      </div>
    </div>
  );
}
