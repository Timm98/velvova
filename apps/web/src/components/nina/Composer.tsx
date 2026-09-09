"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Mic, Square, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { DokumentKnopf } from "./DokumentKnopf";
import { Modellwahl } from "./Modellwahl";

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
  dokumenteFür,
  modellwahl = false,
  vorgabe,
}: {
  onSend: (text: string, options?: { fromVoice?: boolean }) => void;
  busy: boolean;
  placeholder: string;
  locale?: string;
  autoFocus?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
  className?: string;
  /**
   * Ein vorbereiteter Satz von aussen — etwa aus einem Vorschlag.
   *
   * ── Warum vorbereiten und nicht senden ──────────────────────────
   *
   * Wer auf „Bewerbung vorbereiten" tippt, hat sich für ein Thema
   * entschieden, nicht für eine Frage. Eine Nachricht, die daraufhin
   * losgeht, nimmt ihm den Satz aus der Hand, den er gerade
   * formulieren wollte — und die Antwort beantwortet etwas, das er so
   * nie gefragt hätte.
   *
   * Der Zähler statt der Zeichenkette als Auslöser: Zweimal derselbe
   * Vorschlag ist zweimal dieselbe Absicht. Verglichen man den Text,
   * täte der zweite Klick nichts — und das sähe aus wie ein defekter
   * Knopf.
   */
  vorgabe?: { text: string; zaehler: number };
  /**
   * Mondays Name — schaltet den Dokumentknopf frei.
   *
   * Bewusst nicht überall: der Composer steht auch im Interview, wo
   * gerade eine bestimmte Frage beantwortet wird. Eine Büroklammer
   * daneben lädt dazu ein, an der Frage vorbei etwas hochzuladen.
   */
  dokumenteFür?: string;
  /** Meldet, ob das Mikrofon gerade zuhört. */
  onListeningChange?: (listening: boolean) => void;
  /**
   * Ob die Modellwahl unter dem Feld steht.
   *
   * Nicht überall: Im Interview beantwortet jemand eine bestimmte
   * Frage, und die Wahl der Intelligenz gehört nicht neben eine
   * Antwort, die zwei Sätze lang ist. Sie steht dort, wo ein Gespräch
   * geführt wird.
   */
  modellwahl?: boolean;
}) {
  const [text, setText] = useState("");
  const [hört, setHört] = useState(false);

  /*
   * Die laufende Aufnahmezeit.
   *
   * Sie ist der Teil, an dem man eine Sprachnachricht erkennt — und
   * die einzige Rückmeldung, die tatsächlich etwas misst. Sekunden
   * genügen; Zehntel machen die Zeile unruhig, ohne etwas zu sagen.
   */
  const [sekunden, setSekunden] = useState(0);

  useEffect(() => {
    if (!hört) {
      setSekunden(0);
      return;
    }
    const t = setInterval(() => setSekunden((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [hört]);

  const dauerText = `${Math.floor(sekunden / 60)}:${String(sekunden % 60).padStart(2, "0")}`;
  const [transkript, setTranskript] = useState("");
  const [stimmeMöglich, setStimmeMöglich] = useState(false);

  const feld = useRef<HTMLTextAreaElement>(null);

  const letzteVorgabe = useRef(0);
  useEffect(() => {
    if (!vorgabe || vorgabe.zaehler === letzteVorgabe.current) return;
    letzteVorgabe.current = vorgabe.zaehler;
    setText(vorgabe.text);
    const el = feld.current;
    if (!el) return;
    el.focus();
    /* Cursor ans Ende: Man schreibt weiter, man überschreibt nicht. */
    requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
  }, [vorgabe]);
  const erkennung = useRef<Erkennung | null>(null);
  const festerTeil = useRef("");

  useEffect(() => {
    setStimmeMöglich(erkennungBauen(locale) !== null);
  }, [locale]);

  useEffect(() => {
    if (autoFocus) feld.current?.focus();
  }, [autoFocus]);

  // Beim Verlassen der Komponente aufräumen. Ohne das bleibt Monday im
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
     * Zwei Dinge hängen daran: Monday verstummt sofort (wer zu sprechen
     * anfängt, will nicht warten, bis sie ausgeredet hat), und das
     * Monday-Bild wechselt auf „zuhören".
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
        /*
         * Pille, nicht abgerundetes Rechteck (V7 §3.2, §8.4).
         *
         * Der grosse Radius trägt sich auch beim Wachsen: sobald der
         * Text mehrfach umbricht, wird aus der Pille von selbst eine
         * stark gerundete Fläche — CSS klemmt den Radius auf die halbe
         * Höhe. Es braucht also keine Umschaltung, die man vergessen
         * könnte.
         */
        /*
         * Ruhiger Grundschatten, zurückgenommener Schein beim Fokus.
         *
         * Vorher: `shadow-lg` als Grundzustand und beim Tippen ein
         * 40 Pixel weiter Schein mit 14 Prozent Deckkraft. Zusammen
         * lag um das Feld eine deutlich sichtbare Wolke — auf einer
         * hellen Fläche wirkt das wie ein Leuchten, das etwas
         * ankündigt, und angekündigt wird nichts.
         *
         * Jetzt `shadow-md` und ein Schein von 26 Pixeln bei 8
         * Prozent. Der Ring von zwei Pixeln bleibt unverändert: Er ist
         * die Fokusanzeige und muss für Tastaturbedienung deutlich
         * bleiben — ihn mit abzuschwächen wäre keine Zurückhaltung,
         * sondern ein Zugänglichkeitsfehler.
         */
        /* Der Name für den Übergang zur Stellensuche — siehe
           `.uebergang-sucheingabe` in globals.css. Dasselbe Feld
           trägt ihn dort oben. */
        "uebergang-sucheingabe",
        "rounded-(--radius-pill) bg-raised p-2.5 shadow-md transition-[box-shadow] duration-(--duration-base)",
        "focus-within:shadow-[0_0_0_2px_var(--primary),0_8px_26px_rgba(98,92,255,0.08)]",
        className,
      )}
    >
      {/*
        ── Aufnahme wie eine Sprachnachricht ──────────────────
        
        Vorher: ein Block mit Überschrift „Ich höre zu", dem
        Transkript darunter und drei beschrifteten Knöpfen —
        Übernehmen, Pause, Verwerfen. Das ist ein Formular mit einem
        Mikrofon davor.
        
        Eine Sprachnachricht sieht anders aus, und jeder kennt sie:
        eine Zeile, links das Verwerfen, in der Mitte eine laufende
        Zeit mit Ausschlag, rechts das Senden. Kein Text, der erklärt,
        was gerade passiert — man sieht es.
        
        Das Transkript steht darunter, klein und ohne Überschrift. Es
        ist die Kontrolle, ob richtig verstanden wurde, nicht der
        Inhalt der Zeile.
      */}
      {hört && (
        <div className="grid gap-1.5 px-1.5 pb-1.5 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={verwerfen}
              aria-label="Aufnahme verwerfen"
              className="grid size-9 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-soft hover:text-critical"
            >
              <Trash2 className="size-4" strokeWidth={1.9} />
            </button>

            {/*
              Der Ausschlag ist eine Anzeige, keine Messung.
              
              Er zeigt, DASS aufgenommen wird — die tatsächliche
              Lautstärke abzugreifen bräuchte einen zweiten Zugriff auf
              dasselbe Mikrofon, und dafür ist die Auskunft zu klein.
              Die Balken laufen deshalb gleichmässig, mit versetzten
              Verzögerungen, damit es nicht wie ein Ladebalken wirkt.
            */}
            <span aria-hidden className="flex flex-1 items-center gap-[3px] overflow-hidden">
              {Array.from({ length: 24 }, (_, i) => (
                <span
                  key={i}
                  className="w-[3px] shrink-0 rounded-full bg-accent/70 motion-safe:animate-[welle_1100ms_ease-in-out_infinite]"
                  style={{
                    height: `${6 + ((i * 7) % 13)}px`,
                    animationDelay: `${(i % 8) * 90}ms`,
                  }}
                />
              ))}
            </span>

            <span className="shrink-0 font-mono text-sm tabular text-ink-2">{dauerText}</span>

            <button
              type="button"
              onClick={diktatStoppen}
              aria-label="Aufnahme pausieren"
              className="grid size-9 shrink-0 place-items-center rounded-full text-ink-3 transition-colors hover:bg-soft hover:text-ink"
            >
              <Square className="size-3.5" strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={übernehmen}
              aria-label="Aufnahme senden"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-accent-on transition-opacity hover:opacity-90"
            >
              <Check className="size-4" strokeWidth={2} />
            </button>
          </div>

          {/* Die Kontrolle, ob richtig verstanden wurde. Ohne
              Überschrift: Was da steht, erklärt sich. */}
          <p aria-live="polite" className="min-h-5 px-1 text-sm leading-relaxed text-ink-3">
            {transkript || "…"}
          </p>
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
          /* min-h-12 plus p-2.5 der Hülle ergibt 68px Ruhehöhe — in der
             Spanne 64–76 aus §8.4. Die Schrift folgt der Skala statt
             einem festen Pixelwert. */
          className="max-h-[200px] min-h-12 flex-1 resize-none bg-transparent px-4 py-3 text-base leading-relaxed text-ink outline-none placeholder:text-ink-3 disabled:opacity-60"
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

        {dokumenteFür && (
          <DokumentKnopf
            assistantName={dokumenteFür}
            // Was Monday gelesen hat, gehört ins Gespräch — sonst passiert
            // es unsichtbar in einem Aufklappfeld und niemand weiss,
            // worauf sich ihre nächste Antwort stützt.
            onFertig={(zusammenfassung) => onSend(zusammenfassung)}
          />
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

      {/*
        Die Modellwahl steht UNTER der Eingabezeile, rechts.

        Nicht darin: Sie gehört nicht in die Reihe mit Mikrofon und
        Senden — das sind Handlungen, und dies ist eine Einstellung.
        Und nicht links: Dort beginnt der Text, und der Blick soll
        zuerst dorthin.
      */}
      {modellwahl && (
        <div className="flex justify-end px-1.5 pb-1">
          <Modellwahl />
        </div>
      )}
    </div>
  );
}
