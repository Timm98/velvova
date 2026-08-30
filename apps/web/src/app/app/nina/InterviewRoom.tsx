"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, PauseCircle, Sparkle, X } from "lucide-react";
import { confirmEvidence, rejectEvidence } from "@/lib/profile";
import { pauseSession } from "@/lib/interview";
import { Composer } from "@/components/nina/Composer";
import { NinaVisual } from "@/components/nina/NinaVisual";
import { SpeakButton } from "@/components/nina/SpeakButton";
import { ProgressDrawer } from "@/components/nina/ProgressDrawer";
import { JobSuggestions } from "@/components/nina/JobSuggestions";
import { useNina } from "@/components/nina/NinaProvider";
import { cn } from "@/lib/cn";

/**
 * Das Karrieregespräch.
 *
 * Eine Spalte, 820 Pixel breit, mit Licht dahinter. Kein rechtes Panel,
 * keine Themenleiste, keine Nachrichtenkarten.
 *
 * Was diese Fassung anders macht als die vorige:
 *
 *   **Die Frage bekommt Raum.** Ninas aktuelle Frage steht groß und
 *   frei auf der Fläche, nicht in einer Sprechblase. Eine Frage nach
 *   dem eigenen Berufsweg in einem grauen Kasten liest sich wie ein
 *   Formularfeld.
 *
 *   **Der Fortschritt ist ein Satz, keine Zahl.** „Wir lernen gerade
 *   deine Arbeitsweise kennen“ statt „Frage 3 von 40“. Die Zahl würde
 *   eine Länge versprechen, die niemand einhalten kann, und sie macht
 *   aus einem Gespräch eine Strecke.
 *
 *   **Der Bildschirm ist nie leer.** Hinter dem Gespräch liegt ein sehr
 *   weiches violettes Licht, unter dem Composer stehen Antwortimpulse.
 *   Eine große weiße Fläche mit einer kleinen Frage darin wirkt
 *   unfertig, egal wie gut die Frage ist.
 */

interface Hypothese {
  id: string;
  statement: string;
}

/**
 * Antwortimpulse je Stufe.
 *
 * Ausdrücklich Hilfestellungen, keine vorgegebenen Antworten: sie
 * stehen unter dem Eingabefeld, nicht darin, und wer eigene Worte hat,
 * sieht sie gar nicht erst an. Für Menschen, die vor einem leeren Feld
 * hängenbleiben, sind sie der Unterschied zwischen Anfangen und
 * Wegklicken.
 */
const IMPULSE_JE_STUFE: Record<string, string[]> = {
  orientation: [
    "Mehr Entwicklung",
    "Besseres Gehalt",
    "Passendere Aufgaben",
    "Ich weiß es noch nicht",
  ],
  current_situation: ["Ich bin angestellt", "Ich suche gerade aktiv", "Ich orientiere mich neu"],
  evidence_discovery: [
    "Ein Projekt, auf das ich stolz bin",
    "Etwas, das schiefging",
    "Ich weiß nicht, wo ich anfangen soll",
  ],
  task_preferences: ["Mit Menschen arbeiten", "Aufbauen und ordnen", "Analysieren", "Erklären"],
  work_style: ["Lieber im Team", "Lieber selbstständig", "Klare Struktur", "Viel Freiraum"],
  values_and_tradeoffs: ["Sicherheit", "Entwicklung", "Sinn", "Zeit für Privates"],
  constraints: ["Höchstens zwei Tage Büro", "Kein Schichtdienst", "Gehalt ist mir wichtig"],
  role_hypotheses: ["Zeig mir ungewöhnliche Ideen", "Lieber etwas Naheliegendes"],
  validation: ["Stimmt so", "Das trifft es nicht ganz"],
};

export function InterviewRoom({
  assistantName,
  openingQuestion,
  hypotheses,
  initialMessages,
  conversationId,
  initialStage,
  initialStatus,
  progress,
  labels,
}: {
  assistantName: string;
  openingQuestion: string;
  hypotheses: Hypothese[];
  initialMessages: { id: string; role: "user" | "assistant"; content: string }[];
  conversationId: string | null;
  initialStage: string;
  initialStatus: string;
  progress: { groups: { key: string; label: string; done: boolean }[]; completeness: number };
  labels: { yourAnswer: string; pauseSession: string };
}) {
  const nina = useNina();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erledigt, setErledigt] = useState<Set<string>>(new Set());
  const [fortschrittOffen, setFortschrittOffen] = useState(false);
  const ende = useRef<HTMLDivElement>(null);

  const geladen = useRef(false);
  useEffect(() => {
    if (geladen.current) return;
    geladen.current = true;
    if (initialMessages.length > 0) nina.hydrate(conversationId, initialMessages);
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
  const stufe = nina.stage ?? initialStage;
  const status = nina.stageStatus ?? initialStatus;
  const impulse = IMPULSE_JE_STUFE[stufe] ?? [];
  const nochNichtsGesagt = nina.messages.length === 0;

  return (
    <div className="relative">
      {/*
       * Das Licht hinter dem Gespräch.
       *
       * Ein einziger sehr weiter radialer Verlauf, oben, sehr schwach.
       * Er soll den Blick nicht holen — er soll verhindern, dass die
       * Fläche wie ein leeres Blatt aussieht.
       */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-[420px]"
        style={{ background: "var(--glow-nina)" }}
      />

      <div className="relative mx-auto flex min-h-[calc(100dvh-9rem)] w-full max-w-[820px] flex-col">
        {/* ── Kopf ────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-center gap-x-4 gap-y-3 pb-10">
          {/* Nina selbst, nicht ein Symbol für sie. Das Bild folgt dem
              echten Zustand: zuhören, denken, sprechen, still. */}
          <NinaVisual size="md" className="-my-4 -ml-3" />

          <div className="grid min-w-0 flex-1 gap-0.5">
            <h1 className="font-display text-xl font-semibold tracking-[-0.02em]">
              {assistantName}
            </h1>
            {/* Eine menschliche Statuszeile. Keine Zahl, keine Strecke. */}
            <p aria-live="polite" className="truncate text-sm text-ink-2">
              {status}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setFortschrittOffen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-(--radius-control) bg-soft px-4 text-sm text-ink-2 transition-colors hover:bg-soft-hover hover:text-ink"
          >
            <Sparkle className="size-4" strokeWidth={1.8} />
            Was ich über dich weiß
          </button>

          <button
            type="button"
            onClick={pausieren}
            disabled={pending}
            className="inline-flex h-11 items-center gap-2 rounded-(--radius-control) px-4 text-sm text-ink-2 transition-colors hover:bg-soft hover:text-ink"
          >
            <PauseCircle className="size-4" strokeWidth={1.8} />
            {labels.pauseSession}
          </button>
        </header>

        {/* ── Gespräch ────────────────────────────────────────── */}
        <div className="min-h-0 flex-1">
          {nochNichtsGesagt && (
            /* Die erste Frage bekommt den Raum, den eine erste Frage
               verdient: groß, frei, ohne Kasten. */
            <p className="max-w-[34ch] font-display text-[28px] leading-[1.32] tracking-[-0.02em] text-ink sm:text-[32px]">
              {openingQuestion}
            </p>
          )}

          <ol className="grid gap-8">
            {nina.messages.map((m, i) => {
              /*
               * Die letzte Nachricht groß — aber nur, wenn sie kurz ist.
               *
               * Eine Frage in Schaugröße wirkt einladend. Eine
               * zehnzeilige Zusammenfassung in derselben Größe wirkt
               * erschlagend, und genau die kommt regelmäßig: Nina fasst
               * nach vier bis sechs Antworten zusammen.
               */
              const istLetzte =
                i === nina.messages.length - 1 && m.role === "assistant" && m.content.length < 260;
              return (
                <li key={m.id} className={cn("grid", m.role === "user" && "justify-items-end")}>
                  {m.role === "user" ? (
                    /* Nutzerantworten als weiche Bubble — sie sind kurz
                       und gehören sichtbar der Person. */
                    <p className="max-w-[80%] whitespace-pre-wrap rounded-(--radius-textarea) rounded-br-lg bg-soft px-5 py-3.5 leading-relaxed">
                      {m.content}
                    </p>
                  ) : (
                    /* Ninas Antworten liegen frei auf der Fläche. Die
                       letzte etwas größer: sie ist die aktuelle Frage. */
                    <p
                      aria-live={istLetzte ? "polite" : undefined}
                      className={cn(
                        "max-w-[var(--measure)] whitespace-pre-wrap text-ink",
                        istLetzte
                          ? "font-display text-[21px] leading-[1.45] tracking-[-0.01em] sm:text-[23px]"
                          : "text-[17px] leading-relaxed",
                      )}
                    >
                      {m.content}
                      {m.streaming && (
                        <span
                          aria-hidden
                          className="ml-1 inline-block h-5 w-[2px] translate-y-0.5 rounded-full bg-accent motion-safe:animate-pulse"
                        />
                      )}
                    </p>
                  )}
                  {m.role === "assistant" && !m.streaming && (
                    <SpeakButton messageId={m.id} className="mt-2 -ml-3 justify-self-start" />
                  )}
                </li>
              );
            })}
          </ol>

          {/* ── Zustimmung, Stellen zu sehen ──────────────────── */}
          {/*
           * Der eine Klick zwischen „Nina bietet an“ und „Stellen sind
           * da“.
           *
           * Ohne ihn erscheinen Vorschläge, weil ein Modell fand, es sei
           * so weit. Mit ihm, weil ein Mensch es wollte — und die
           * Zustimmung landet serverseitig in einer eigenen Spalte,
           * nicht in einem abgeleiteten Zustand.
           */}
          {nina.offeringJobs && nina.jobs.length === 0 && (
            <div className="mt-8 flex flex-wrap items-center gap-3 rounded-(--radius-surface) bg-ice px-6 py-5">
              <p className="min-w-0 flex-1 leading-relaxed text-ink-2">
                {nina.readiness?.state === "ready"
                  ? "Ich habe genug verstanden, um dir eine sinnvoll gerankte Liste zu zeigen."
                  : "Ich kann dir schon erste Richtungen zeigen — die Einschätzung ist noch vorläufig."}
              </p>
              <button
                type="button"
                onClick={() => {
                  nina.agreeToSeeJobs();
                  void nina.send("Ja, zeig mir bitte passende Stellen.");
                }}
                className="inline-flex h-11 shrink-0 items-center rounded-(--radius-control) bg-accent px-5 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover"
              >
                Stellen ansehen
              </button>
              <button
                type="button"
                onClick={() => void nina.send("Lass uns mein Profil erst noch genauer machen.")}
                className="inline-flex h-11 shrink-0 items-center rounded-(--radius-control) px-4 text-sm text-ink-2 transition-colors hover:bg-raised"
              >
                Profil zuerst schärfen
              </button>
            </div>
          )}

          {/* ── Jobvorschläge im Gespräch ─────────────────────── */}
          {nina.jobs.length > 0 && (
            <div className="mt-10">
              <JobSuggestions jobs={nina.jobs} readiness={nina.readiness} />
            </div>
          )}

          {/* ── Was Nina verstanden hat ───────────────────────── */}
          {offen.length > 0 && (
            <div className="mt-10 rounded-(--radius-surface) bg-lavender px-6 py-5">
              <p className="text-sm text-ink-2">
                Das habe ich verstanden. Nichts davon zählt, bevor du es bestätigt hast.
              </p>
              <ul className="mt-4 grid gap-3">
                {offen.slice(0, 4).map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
                  >
                    <span className="min-w-0 flex-1 leading-relaxed">{h.statement}</span>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => bewerten(h.id, true)}
                        disabled={pending}
                        className="inline-flex h-10 items-center gap-1.5 rounded-(--radius-control) bg-raised px-4 text-sm shadow-sm transition-colors hover:bg-soft"
                      >
                        <Check className="size-4 text-positive" strokeWidth={2.4} />
                        Stimmt
                      </button>
                      <button
                        type="button"
                        onClick={() => bewerten(h.id, false)}
                        disabled={pending}
                        className="inline-flex h-10 items-center gap-1.5 rounded-(--radius-control) px-4 text-sm text-ink-2 transition-colors hover:bg-raised"
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
              className="mt-8 rounded-(--radius-surface) bg-caution-soft px-5 py-4 leading-relaxed text-ink-2"
            >
              {nina.error}
            </p>
          )}

          <div ref={ende} className="h-4" />
        </div>

        {/* ── Composer ────────────────────────────────────────── */}
        <div className="sticky bottom-0 -mx-2 bg-gradient-to-t from-page via-page to-transparent px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-8">
          <Composer
            onSend={(text, options) => void nina.send(text, options)}
            busy={nina.busy}
            onListeningChange={nina.setListening}
            placeholder={labels.yourAnswer}
            autoFocus
          />

          {impulse.length > 0 && !nina.busy && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {impulse.map((impuls) => (
                <li key={impuls}>
                  <button
                    type="button"
                    onClick={() => void nina.send(impuls)}
                    className="rounded-(--radius-chip) bg-soft px-4 py-2 text-sm text-ink-2 transition-colors hover:bg-soft-hover hover:text-ink"
                  >
                    {impuls}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ProgressDrawer
        open={fortschrittOffen}
        onClose={() => setFortschrittOffen(false)}
        groups={nina.progressGroups ?? progress.groups}
        completeness={nina.readiness?.score ?? progress.completeness}
        readiness={nina.readiness}
        assistantName={assistantName}
      />
    </div>
  );
}
