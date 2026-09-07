"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useNina } from "./NinaProvider";

/**
 * Die eine Nachricht beim ersten Besuch der Stellenseite.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es sie gibt
 * ══════════════════════════════════════════════════════════════
 *
 * Monday hat nur noch einen Einstieg: eine 36 Pixel grosse Blase unten
 * rechts. Das ist beabsichtigt leise — und leise heisst auch
 * übersehbar. Ohne einen einzigen Hinweis merkt niemand, dass die
 * Seite fragen lässt.
 *
 * Sie sagt zwei Dinge, und das zweite ist das wichtigere: dass man
 * Monday NICHT braucht. Wer filtern will, filtert oben. Ein Hinweis,
 * der nur für sich wirbt, macht aus einem Angebot eine Pflicht.
 *
 * ══════════════════════════════════════════════════════════════
 * Einmal. Wirklich einmal.
 * ══════════════════════════════════════════════════════════════
 *
 * `localStorage`, nicht `sessionStorage`: Beim zweiten Besuch weiss
 * man es. Ein Hinweis, der bei jedem Besuch wiederkommt, ist die
 * Sorte Einblendung, die man wegklickt, ohne hinzusehen — und dann
 * klickt man auch die weg, die etwas zu sagen hat.
 *
 * Nur auf der Stellenseite: Dort ist die Blase nützlich, weil es
 * etwas zu fragen gibt. Auf einer Einstellungsseite wäre derselbe
 * Satz eine Behauptung ins Leere.
 */

const SCHLUESSEL = "nina-hinweis-jobs";
const WARTEN_MS = 3500;
const BLEIBT_MS = 14000;

/**
 * Ein kurzer Ton, wie eine eingehende Nachricht.
 *
 * Über die Web-Audio-Schnittstelle statt einer Tondatei: Zwei Töne
 * sind ein paar Zeilen Code und kein Anhang, der geladen, gecacht und
 * ausgeliefert werden muss.
 *
 * ── Warum er stumm bleiben darf ───────────────────────────────
 *
 * Browser lassen Ton vor der ersten Nutzerhandlung nicht zu. Wer die
 * Seite gerade geöffnet und noch nichts angeklickt hat, hört deshalb
 * nichts — und das ist richtig so: Eine Seite, die ungefragt Geräusche
 * macht, ist ein Ärgernis. Der Versuch bleibt trotzdem stehen, weil er
 * greift, sobald jemand vorher irgendwo geklickt hat.
 *
 * Scheitert er, passiert nichts weiter. Ein Hinweis ohne Ton ist ein
 * Hinweis; eine Ausnahme wegen eines Tons wäre ein Fehler.
 */
function tonSpielen() {
  try {
    const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === "suspended") {
      void ctx.close();
      return;
    }

    /* Zwei kurze Töne, der zweite höher — die Tonfolge, die man als
       „Nachricht angekommen" liest, ohne dass sie einem Gerät
       nachgemacht ist. */
    const jetzt = ctx.currentTime;
    for (const [versatz, hz] of [
      [0, 880],
      [0.11, 1320],
    ] as const) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = hz;
      /* Eine Hüllkurve statt eines harten Ein- und Ausschaltens: Ein
         abrupt endender Sinus knackt hörbar. */
      g.gain.setValueAtTime(0, jetzt + versatz);
      g.gain.linearRampToValueAtTime(0.06, jetzt + versatz + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, jetzt + versatz + 0.09);
      o.connect(g).connect(ctx.destination);
      o.start(jetzt + versatz);
      o.stop(jetzt + versatz + 0.1);
    }
    setTimeout(() => void ctx.close(), 600);
  } catch {
    /* Kein Ton. Der Hinweis steht trotzdem da. */
  }
}

export function NinaHinweis({ assistantName }: { assistantName: string }) {
  const nina = useNina();
  const pfad = usePathname();
  const [sichtbar, setSichtbar] = useState(false);

  const aufStellenseite = pfad.startsWith("/app/jobs");

  useEffect(() => {
    if (!aufStellenseite) return;

    /*
     * `localStorage` kann werfen.
     *
     * In einem privaten Fenster oder bei blockierten Seitendaten wirft
     * schon der Zugriff. Ein Hinweis ist das Letzte, wofür eine Seite
     * abstürzen darf — im Zweifel erscheint er eben nicht.
     */
    try {
      if (localStorage.getItem(SCHLUESSEL)) return;
    } catch {
      return;
    }

    const auf = setTimeout(() => {
      /* Wer die Fläche schon offen hat, braucht keinen Hinweis auf
         sie. */
      if (nina.open) return;
      setSichtbar(true);
      tonSpielen();
      try {
        localStorage.setItem(SCHLUESSEL, "1");
      } catch {
        /* Nicht speichern zu können heisst nur: Er kommt beim nächsten
           Besuch wieder. Kein Grund, ihn zu unterdrücken. */
      }
    }, WARTEN_MS);

    return () => clearTimeout(auf);
  }, [aufStellenseite, nina.open]);

  useEffect(() => {
    if (!sichtbar) return;
    const zu = setTimeout(() => setSichtbar(false), BLEIBT_MS);
    return () => clearTimeout(zu);
  }, [sichtbar]);

  if (!sichtbar || nina.open) return null;

  return (
    <div
      role="status"
      /*
       * Über der Blase, an derselben Kante.
       *
       * `bottom-16` ist dieselbe Höhe, auf der auch die Gesprächskarte
       * aufgeht — der Hinweis steht damit dort, wo gleich die Antwort
       * stehen wird.
       */
      className={
        "fixed right-5 z-40 max-w-[19rem] rounded-(--radius-lg) " +
        "bg-raised px-3.5 py-3 text-sm leading-relaxed text-ink-2 ring-1 ring-line-2 " +
        "bottom-[calc(var(--nav-bottom-h)+3.5rem)] md:bottom-16 " +
        "motion-safe:animate-[fade-up_200ms_ease-out]"
      }
    >
      <button
        type="button"
        onClick={() => setSichtbar(false)}
        aria-label="Hinweis schliessen"
        className="float-right -mr-1 ml-2 grid size-5 place-items-center rounded-full text-ink-3 transition-colors hover:text-ink-2"
      >
        <X aria-hidden className="size-3.5" strokeWidth={1.9} />
      </button>

      <button
        type="button"
        onClick={() => {
          setSichtbar(false);
          nina.setOpen(true);
        }}
        className="text-left"
      >
        Nutz dieses Fenster für Fragen oder Wünsche. Sonst kannst du deine Stellen oben ganz
        normal filtern.
        <span className="sr-only"> — {assistantName} öffnen</span>
      </button>
    </div>
  );
}
