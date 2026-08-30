"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Mic, Square, X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Der Composer.
 *
 * Eine einzige weiche Fläche, die alles trägt: Text, Stimme, Senden.
 * Vorher war Diktieren ein eigener lila Kasten neben dem Feld — zwei
 * Wege für dieselbe Sache, nebeneinander, und der lautere war der
 * seltenere.
 *
 * Beim Antippen des Mikrofons wächst dieselbe Fläche und zeigt das
 * Transkript, während es entsteht. Danach fällt sie in ihren normalen
 * Zustand zurück. Es öffnet sich nichts, es schiebt sich nichts über
 * etwas anderes.
 *
 * Das Diktat läuft über die Spracherkennung des Browsers. Das ist eine
 * bewusste Grenze: es verlässt kein Ton das Gerät, solange niemand
 * „Übernehmen“ drückt. Wo es die Erkennung nicht gibt — Firefox, ältere
 * Browser — verschwindet das Mikrofon einfach. Ein Knopf, der nichts
 * tut, ist schlimmer als keiner.
 */

interface Erkennung {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: { isFinal: boolean; 0: { transcript: string } };
  };
}

function erkennungBauen(locale: string): Erkennung | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as unknown as { SpeechRecognition?: new () => Erkennung }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => Erkennung })
      .webkitSpeechRecognition;
  if (!Ctor) return null;

  const erkennung = new Ctor();
  erkennung.lang = locale === "en" ? "en-US" : "de-DE";
  erkennung.continuous = true;
  erkennung.interimResults = true;
  return erkennung;
}

export function Composer({
  onSend,
  busy,
  placeholder,
  locale = "de",
  autoFocus = false,
  onSkip,
  skipLabel,
  className,
  onListeningChange,
}: {
  onSend: (text: string, options?: { fromVoice?: boolean }) => void;
  busy: boolean;
  placeholder: string;
  locale?: string;
  autoFocus?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
  className?: string;
  /** Meldet, ob das Mikrofon gerade zuhört. */
  onListeningChange?: (listening: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [hört, setHört] = useState(false);
  const [transkript, setTranskript] = useState("");
  const [stimmeMöglich, setStimmeMöglich] = useState(false);

  const feld = useRef<HTMLTextAreaElement>(null);
  const erkennung = useRef<Erkennung | null>(null);
  const festerTeil = useRef("");

  useEffect(() => {
    setStimmeMöglich(erkennungBauen(locale) !== null);
  }, [locale]);

  useEffect(() => {
    if (autoFocus) feld.current?.focus();
  }, [autoFocus]);

  // Beim Verlassen der Komponente aufräumen. Ohne das bleibt Nina im
  // Zustand „hört zu", während niemand mehr spricht.
  useEffect(
    () => () => {
      erkennung.current?.stop();
      erkennung.current = null;
    },
    [],
  );

  // Das Feld wächst mit dem Text, bis zu einer Grenze. Ein Feld, das
  // unbegrenzt wächst, schiebt irgendwann den Senden-Knopf aus dem Bild.
  useEffect(() => {
    const el = feld.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  function diktatStarten() {
    const neue = erkennungBauen(locale);
    if (!neue) return;

    /*
     * Das Mikrofon meldet sich beim Provider an.
     *
     * Zwei Dinge hängen daran: Nina verstummt sofort (wer zu sprechen
     * anfängt, will nicht warten, bis sie ausgeredet hat), und das
     * Nina-Bild wechselt auf „zuhören".
     */
    onListeningChange?.(true);

    festerTeil.current = "";
    setTranskript("");
    setHört(true);

    neue.onresult = (event) => {
      let fest = "";
      let vorläufig = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const stück = event.results[i]!;
        if (stück.isFinal) fest += stück[0].transcript;
        else vorläufig += stück[0].transcript;
      }
      festerTeil.current += fest;
      setTranskript(festerTeil.current + vorläufig);
    };
    neue.onerror = () => setHört(false);
    neue.onend = () => setHört(false);

    erkennung.current = neue;
    neue.start();
  }

  function diktatStoppen() {
    erkennung.current?.stop();
    erkennung.current = null;
    setHört(false);
    onListeningChange?.(false);
  }

  function übernehmen() {
    diktatStoppen();
    const gesprochen = transkript.trim();
    if (gesprochen) setText((v) => (v ? `${v} ${gesprochen}` : gesprochen));
    setTranskript("");
    feld.current?.focus();
  }

  function verwerfen() {
    diktatStoppen();
    setTranskript("");
    festerTeil.current = "";
  }

  function senden(ausStimme = false) {
    const inhalt = text.trim();
    if (!inhalt || busy) return;
    onSend(inhalt, { fromVoice: ausStimme });
    setText("");
  }

  return (
    <div
      className={cn(
        "rounded-(--radius-sheet) bg-raised p-2 shadow-lg transition-[box-shadow] duration-(--duration-base)",
        "focus-within:shadow-[0_0_0_2px_var(--primary),0_12px_40px_rgba(98,92,255,0.14)]",
        className,
      )}
    >
      {/* Das Live-Transkript. Teil derselben Fläche, kein eigener Kasten. */}
      {hört && (
        <div className="grid gap-3 px-3 pb-3 pt-2">
          <div className="flex items-center gap-2.5">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
            </span>
            <span className="text-sm font-medium">Ich höre zu</span>
          </div>
          <p
            aria-live="polite"
            className="min-h-6 text-[15px] leading-relaxed text-ink-2"
          >
            {transkript || <span className="text-ink-3">…</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={übernehmen}
              className="inline-flex h-9 items-center gap-2 rounded-(--radius-control) bg-accent px-4 text-sm font-medium text-accent-on transition-colors hover:bg-accent-hover"
            >
              <Check className="size-4" strokeWidth={2} />
              Übernehmen
            </button>
            <button
              type="button"
              onClick={diktatStoppen}
              className="inline-flex h-9 items-center gap-2 rounded-(--radius-control) bg-soft px-4 text-sm transition-colors hover:bg-soft-hover"
            >
              <Square className="size-3.5" strokeWidth={2} />
              Pause
            </button>
            <button
              type="button"
              onClick={verwerfen}
              className="inline-flex h-9 items-center gap-2 rounded-(--radius-control) px-4 text-sm text-ink-2 transition-colors hover:bg-soft"
            >
              <X className="size-4" strokeWidth={1.8} />
              Verwerfen
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <textarea
          ref={feld}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sendet, Umschalt+Enter bricht die Zeile um. Wer eine
            // längere Antwort schreibt, will umbrechen können.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              senden();
            }
          }}
          placeholder={placeholder}
          disabled={busy}
          aria-label={placeholder}
          className="max-h-[200px] min-h-11 flex-1 resize-none bg-transparent px-3.5 py-3 text-[15px] leading-relaxed text-ink outline-none placeholder:text-ink-3 disabled:opacity-60"
        />

        {onSkip && skipLabel && (
          <button
            type="button"
            onClick={onSkip}
            className="mb-0.5 hidden h-10 items-center rounded-(--radius-control) px-3.5 text-sm text-ink-3 transition-colors hover:bg-soft hover:text-ink-2 sm:inline-flex"
          >
            {skipLabel}
          </button>
        )}

        {stimmeMöglich && !hört && (
          <button
            type="button"
            onClick={diktatStarten}
            aria-label="Antwort diktieren"
            className="mb-0.5 grid size-11 shrink-0 place-items-center rounded-(--radius-control) text-ink-2 transition-colors hover:bg-soft hover:text-ink"
          >
            <Mic className="size-[18px]" strokeWidth={1.8} />
          </button>
        )}

        <button
          type="button"
          onClick={() => senden()}
          disabled={busy || text.trim().length === 0}
          aria-label="Senden"
          className={cn(
            "mb-0.5 grid size-11 shrink-0 place-items-center rounded-(--radius-control) transition-all duration-(--duration-fast)",
            text.trim().length > 0 && !busy
              ? "bg-accent text-accent-on shadow-sm hover:bg-accent-hover active:translate-y-px"
              : "bg-soft text-ink-3",
          )}
        >
          <ArrowUp className="size-[18px]" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
