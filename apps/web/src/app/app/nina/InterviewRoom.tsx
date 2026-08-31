"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, Check, Mic, PauseCircle, Sparkle, Square, X } from "lucide-react";
import { confirmEvidence, rejectEvidence } from "@/lib/profile";
import { pauseSession } from "@/lib/interview";
import { Composer } from "@/components/nina/Composer";
import { NinaVisual } from "@/components/nina/NinaVisual";
import { SpeakButton } from "@/components/nina/SpeakButton";
import { ProgressDrawer } from "@/components/nina/ProgressDrawer";
import { JobSuggestions } from "@/components/nina/JobSuggestions";
import { useNina } from "@/components/nina/NinaProvider";
import { useLiveVoice } from "@/components/nina/useLiveVoice";
import { LIVE_TEXT } from "@/lib/nina/live-voice";
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
 *
 *   **Nur der Nachrichtenstrom scrollt.** Kopf und Eingabefeld stehen
 *   fest. Vorher scrollte die ganze Seite: nach zwanzig Nachrichten war
 *   Nina aus dem Bild, und wer etwas schreiben wollte, musste erst
 *   wieder nach unten. Auf dem Telefon kam die Tastatur dazu und schob
 *   das Feld vollends weg.
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
  const strom = useRef<HTMLDivElement>(null);
  const [neueAntwort, setNeueAntwort] = useState(false);
  const [gescrollt, setGescrollt] = useState(false);

  const geladen = useRef(false);
  useEffect(() => {
    if (geladen.current) return;
    geladen.current = true;
    if (initialMessages.length > 0) nina.hydrate(conversationId, initialMessages);
  }, [initialMessages, conversationId, nina]);

  /*
   * Wie nah am unteren Rand ist nah genug?
   *
   * 120 Pixel — etwa zwei Zeilen. Kleiner, und schon das Nachrücken
   * einer Zeile während des Streamings gilt als „weggescrollt";
   * grösser, und die Ansicht springt jemandem hinterher, der gerade
   * eine ältere Antwort liest.
   */
  const NAH_GENUG = 120;

  const amEnde = useCallback(() => {
    const el = strom.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NAH_GENUG;
  }, []);

  const nachUnten = useCallback((sofort = false) => {
    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ende.current?.scrollIntoView({
      behavior: sofort || ruhig ? "auto" : "smooth",
      block: "end",
    });
    setNeueAntwort(false);
  }, []);

  /*
   * Mitlaufen — aber nur, wenn die Person unten steht.
   *
   * Wer nach oben gescrollt hat, liest etwas. Ihn beim nächsten Token
   * nach unten zu reissen ist die unhöflichste Bewegung, die eine
   * Oberfläche machen kann: der Satz, den er gerade las, ist weg, und
   * er weiss nicht wohin. Stattdessen erscheint unten eine Pille.
   *
   * Die Prüfung läuft in `requestAnimationFrame`, weil `scrollHeight`
   * den Browser zum Neuberechnen des Layouts zwingt. Bei jedem
   * gestreamten Token direkt gemessen, wäre das ein Layout-Durchlauf
   * pro Zeichen.
   */
  useEffect(() => {
    if (nina.messages.length === 0) return;
    const bild = requestAnimationFrame(() => {
      if (amEnde()) nachUnten();
      else setNeueAntwort(true);
    });
    return () => cancelAnimationFrame(bild);
  }, [nina.messages, amEnde, nachUnten]);

  /*
   * Zwei Dinge am Scrollzustand: ob die Pille weg darf, und ob Nina
   * klein werden soll. Beides aus derselben Messung, damit nicht zwei
   * Zuhörer dasselbe Layout zweimal berechnen.
   */
  useEffect(() => {
    const el = strom.current;
    if (!el) return;
    let angefordert = false;

    const beiScroll = () => {
      if (angefordert) return;
      angefordert = true;
      requestAnimationFrame(() => {
        angefordert = false;
        setGescrollt(el.scrollTop > 24);
        if (amEnde()) setNeueAntwort(false);
      });
    };

    el.addEventListener("scroll", beiScroll, { passive: true });
    return () => el.removeEventListener("scroll", beiScroll);
  }, [amEnde]);

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

  /*
   * Die zuletzt fertig gestreamte Antwort.
   *
   * Sie ist das Signal zum Vorlesen. Bewusst erst, wenn `streaming`
   * vorbei ist: eine halb fertige Antwort vorzulesen hiesse, Nina beim
   * Nachdenken zuzuhören.
   */
  const letzteAntwort = (() => {
    for (let i = nina.messages.length - 1; i >= 0; i--) {
      const m = nina.messages[i]!;
      if (m.role !== "assistant") continue;
      return m.streaming ? null : { id: m.id };
    }
    return null;
  })();

  const live = useLiveVoice({
    send: async (text) => {
      await nina.send(text, { fromVoice: true });
    },
    fertigeAntwort: letzteAntwort,
  });

  // Das Mikrofon soll Ninas Bild bewegen: zuhören, denken, sprechen.
  useEffect(() => {
    nina.setListening(live.stand.zustand === "hört");
  }, [live.stand.zustand, nina]);

  const offen = hypotheses.filter((h) => !erledigt.has(h.id));
  const stufe = nina.stage ?? initialStage;
  const status = nina.stageStatus ?? initialStatus;
  const impulse = IMPULSE_JE_STUFE[stufe] ?? [];
  const nochNichtsGesagt = nina.messages.length === 0;

  return (
    /*
     * `h-full` bis ganz nach unten durchreichen.
     *
     * Eine Höhe in Prozent misst sich am Elternteil. Fehlt sie einem
     * einzigen Element in der Kette, wird daraus `auto`, und alles
     * darunter wächst wieder mit dem Inhalt — ohne dass etwas bricht,
     * das man sehen würde. Genau hier war die Lücke: `main` hatte seine
     * feste Höhe, die Spalte darin `h-full`, und diese Hülle dazwischen
     * nichts.
     */
    <div className="relative h-full">
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

      <div className="relative mx-auto flex h-full w-full max-w-[820px] flex-col">
        {/* ── Kopf ────────────────────────────────────────────── */}
        {/* `gap-x-6`, nicht 4: das Licht hinter Nina reicht bewusst 18%
            über ihre Fläche hinaus (`inset-[-18%]`), bei 120px also gut
            20 Pixel. Mit dem kleineren Abstand lag der Schein auf dem
            Wort „Nina". */}
        <header className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 pt-6 pb-5">
          {/*
           * Nina schrumpft, sobald das Gespräch läuft.
           *
           * Gross am Anfang: da ist sie das Einzige auf der Fläche und
           * soll es sein. Klein, sobald jemand scrollt — dann gehört
           * der Platz den Nachrichten.
           *
           * Umgeschaltet wird `size`, nicht eine Hülle drumherum.
           *
           * Der erste Versuch war eine Box mit `overflow-hidden`, die
           * ihre Grösse animiert. Das Ergebnis war ein dunkelvioletter
           * Kasten: das weiche Licht hinter Nina liegt bewusst
           * ausserhalb ihrer Fläche (`inset-[-18%]`), und die Hülle hat
           * es an vier geraden Kanten abgeschnitten.
           *
           * Der Wechsel des `size`-Werts tauscht nur zwei Klassen am
           * selben Element. React baut nichts neu auf, die Szene lebt
           * weiter — die 12 MB werden nicht noch einmal geladen — und
           * der ResizeObserver in NinaScene passt die Leinwand
           * währenddessen mit an.
           */}
          <NinaVisual
            size={gescrollt ? "sm" : "md"}
            className={cn(
              "-ml-3 transition-[width,height] duration-(--duration-slow) ease-(--ease-out)",
              "motion-reduce:transition-none",
            )}
          />

          <div className="grid min-w-0 flex-1 gap-0.5">
            <h1 className="font-display text-xl font-semibold tracking-[-0.02em]">
              {assistantName}
            </h1>
            {/* Eine menschliche Statuszeile. Keine Zahl, keine Strecke. */}
            {/* Zwei Zeilen statt einer abgeschnittenen. Die Statuszeile
                ist ein ganzer Satz („Wir klären gerade, worum es dir
                geht") — mitten im Wort abgeschnitten liest sie sich wie
                ein Fehler, nicht wie eine Auskunft. */}
            <p aria-live="polite" className="line-clamp-2 text-sm text-ink-2">
              {status}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1">
  <button
              type="button"
              onClick={() => setFortschrittOffen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-(--radius-control) bg-soft px-4 text-sm text-ink-2 transition-colors hover:bg-soft-hover hover:text-ink"
            >
              <Sparkle className="size-4" strokeWidth={1.8} />
              Was ich über dich weiß
            </button>

            {/*
             * Die drei Aktionen als EINE Gruppe.
             *
             * Vorher waren es drei gleichrangige Flex-Kinder neben Nina
             * und der Statuszeile. In einer 820 Pixel breiten Spalte
             * passte das nicht: jeder Knopf brach einzeln um, die
             * Kopfzeile wuchs auf vier Reihen und 220 Pixel — ein
             * Drittel der Gesprächsfläche, für drei Knöpfe.
             *
             * Als Gruppe brechen sie gemeinsam in eine zweite Reihe statt
             * einzeln in drei.
             */}
          {/*
             * Der eigene Knopf für das Live-Gespräch (§14.2).
             *
             * Getrennt vom Mikrofon im Composer, und das ist kein Zufall:
             * das eine ist Diktat — sprechen statt tippen, danach lesen
             * und absenden. Das hier ist ein Gespräch, das von selbst
             * weiterläuft. Ein Knopf für beides würde niemandem sagen,
             * was gleich passiert.
             */}
            {/*
              Der Knopf steht IMMER da — auch bevor der Browser
              geantwortet hat, ob er ein Mikrofon hat.
              
              Vorher erschien er erst nach der Hydration. Damit brach
              die Kopfzeile nachträglich in eine zweite Reihe um und
              schob alles darunter 94 Pixel nach unten: gemessene 0,095
              Layoutverschiebung, und für den Menschen ein Satz, der
              beim Lesen wegrutscht.
              
              Ohne Mikrofon ist er abgeschaltet und sagt, warum. Ein
              deaktivierter Knopf ist ehrlicher als einer, der aus dem
              Nichts auftaucht.
            */}
            {(
              <button
                type="button"
                onClick={live.stand.zustand === "aus" ? live.starten : live.beenden}
                disabled={!live.möglich}
                title={live.möglich ? undefined : "Dieser Browser stellt kein Mikrofon bereit."}
                aria-pressed={live.stand.zustand !== "aus"}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-(--radius-control) px-4 text-sm transition-colors",
                  live.stand.zustand === "aus"
                    ? "text-ink-2 hover:bg-soft hover:text-ink"
                    : "bg-accent text-accent-on hover:bg-accent-hover",
                  /*
                   * Gedämpft über die Textfarbe, nicht über Deckkraft.
                   *
                   * `opacity-45` senkt den Kontrast von allem darunter —
                   * axe hat das auf /app/nina als Verstoss gemeldet.
                   * `text-ink-3` ist geprüft und erreicht 4,5:1 auf
                   * jeder Fläche; der Knopf sieht trotzdem inaktiv aus,
                   * weil ihm die Umrandung und der Hover fehlen.
                   */
                  !live.möglich && "cursor-not-allowed text-ink-3 hover:bg-transparent",
                )}
              >
                {live.stand.zustand === "aus" ? (
                  <Mic className="size-4" strokeWidth={1.8} />
                ) : (
                  <Square className="size-3.5 fill-current" strokeWidth={0} />
                )}
                {live.stand.zustand === "aus"
                  ? `Live mit ${assistantName} sprechen`
                  : "Beenden"}
              </button>
            )}

            <button
              type="button"
              onClick={pausieren}
              disabled={pending}
              className="inline-flex h-11 items-center gap-2 rounded-(--radius-control) px-4 text-sm text-ink-2 transition-colors hover:bg-soft hover:text-ink"
            >
              <PauseCircle className="size-4" strokeWidth={1.8} />
              {labels.pauseSession}
            </button>

          </div>

        </header>

        {/* ── Gespräch ────────────────────────────────────────── */}
        {/*
         * `min-h-0` ist hier keine Feinheit, sondern die Bedingung.
         *
         * Ein Flex-Kind hat `min-height: auto` und weigert sich, kleiner
         * zu werden als sein Inhalt. Ohne diese Zeile wächst der
         * Strom mit jeder Nachricht, drückt den Composer aus dem Bild
         * und scrollt nie — `overflow-y-auto` bliebe wirkungslos, ohne
         * dass irgendetwas darauf hinweist.
         */}
        <div
          ref={strom}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-2 pb-6"
        >
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
                    /* Lavendel statt Grau (§8.3): die Bubble gehört
                       sichtbar der Person, und Grau liest sich als
                       „deaktiviert". Die eine eckigere Ecke unten rechts
                       zeigt, von wem sie kommt, ohne einen Pfeil. */
                    <p className="max-w-[80%] whitespace-pre-wrap rounded-(--radius-lg) rounded-br-md bg-lavender px-5 py-3.5 text-base leading-relaxed">
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
                          : "text-base leading-relaxed",
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
        <div className="relative shrink-0 -mx-2 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {/*
           * „Neue Antwort" statt eines Sprungs.
           *
           * Sie erscheint nur, wenn Nina etwas geschrieben hat, während
           * die Person weiter oben las. Ein Klick bringt sie nach
           * unten — freiwillig.
           */}
          {/*
           * Was gerade gehört wird — und was das Gespräch gerade tut.
           *
           * Das Teiltranskript steht über dem Eingabefeld, nicht im
           * Nachrichtenstrom: es ist noch nichts Gesagtes, sondern eine
           * Vermutung, die sich beim Weitersprechen noch ändert.
           */}
          {live.stand.zustand !== "aus" && (
            <div className="mb-2 flex items-center gap-2.5 rounded-(--radius-lg) bg-lavender px-4 py-2.5">
              <span
                aria-hidden
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  live.stand.zustand === "hört" ? "bg-accent motion-safe:animate-pulse" : "bg-ink-3",
                )}
              />
              <p aria-live="polite" className="min-w-0 flex-1 truncate text-sm text-ink-2">
                {live.stand.teiltranskript || live.stand.fehler || LIVE_TEXT[live.stand.zustand]}
              </p>
            </div>
          )}

          {neueAntwort && (
            <button
              type="button"
              onClick={() => nachUnten()}
              className={cn(
                "absolute -top-7 left-1/2 z-10 -translate-x-1/2",
                "inline-flex h-10 items-center gap-2 rounded-(--radius-pill) bg-ink px-4",
                "text-sm font-medium text-ink-inv shadow-lg",
                /*
                 * Nur die Bewegung, nicht die Deckkraft.
                 *
                 * `fade-up` startet bei `opacity: 0`. Während dieser
                 * Zehntelsekunde misst eine Kontrastprüfung weissen
                 * Text auf halbdurchsichtigem Schwarz und meldet einen
                 * Verstoss — im Einzeltest nie, im vollen Lauf
                 * gelegentlich, je nachdem wann axe hinsieht.
                 *
                 * Ein Fehler, den man nur manchmal sieht, ist der
                 * teuerste. Die Pille schiebt sich jetzt nur noch
                 * herein; sichtbar ist sie von der ersten Bildfolge an.
                 */
                "motion-safe:animate-[slide-up-solid_var(--duration-base)_var(--ease-out)]",
              )}
            >
              <ArrowDown className="size-4" strokeWidth={2} />
              Neue Antwort
            </button>
          )}
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
