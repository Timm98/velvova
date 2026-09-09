"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SPRACHEN_MIT_TEXTEN, VORBEREITETE_SPRACHEN } from "@paycheck/i18n";
import { spracheWaehlen } from "./sprachwahl-aktion";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Sprachauswahl in der Kopfzeile
 * ══════════════════════════════════════════════════════════════════
 *
 * Klein und unauffällig: „DE" mit einem Pfeil, daneben Glocke und
 * Profil. Sie ist eine Einstellung, keine Funktion — wer sie braucht,
 * sucht sie oben rechts, und wer sie nicht braucht, soll sie
 * übersehen.
 *
 * ── Warum hier nur steht, was es auch gibt ──────────────────────
 *
 * `VORBEREITETE_SPRACHEN` kennt sieben Codes, `SPRACHEN_MIT_TEXTEN`
 * nur die mit Katalog. Angeboten wird die zweite Liste.
 *
 * Der Grund ist ein stiller Fehler: `getTranslator` fällt bei einem
 * fehlenden Katalog auf die Standardsprache zurück, ohne sich zu
 * beschweren. Wer „Français" wählte, ohne dass es französische Texte
 * gibt, bekäme Deutsch — und hielte das für einen Fehler statt für
 * eine fehlende Übersetzung. Eine Auswahl, die vier Einträge zeigt
 * und zwei davon nicht einlöst, ist schlimmer als eine mit zwei.
 *
 * Kommt ein Katalog dazu, erscheint er hier von selbst. Es gibt keine
 * zweite Liste, die jemand nachpflegen müsste.
 *
 * ── Der Eigenname, nicht die Übersetzung ────────────────────────
 *
 * In der Auswahl steht „English" und nicht „Englisch". Wer die
 * Oberfläche gerade nicht versteht, sucht das Wort, das er kennt —
 * und das ist der Name der Sprache in ihr selbst. Aus demselben Grund
 * steht dort keine Flagge: Sprachen sind keine Länder, und für
 * Englisch, Französisch oder Spanisch gibt es keine, die stimmt.
 */

/**
 * Der Eigenname je Sprache.
 *
 * Ausgeschrieben und nicht aus dem Register abgeleitet. Der erste
 * Versuch las `LOCALES` aus dem i18n-Paket — das ist dort aber die
 * Liste der Codes und nicht das Register mit den Namen, und heraus kam
 * eine Auswahl mit „DE" und „EN" statt „Deutsch" und „English".
 *
 * Sieben Zeilen, die sich nie ändern, sind hier besser aufgehoben als
 * eine Ableitung, die beim nächsten Umbau still etwas anderes liefert.
 */
const EIGENNAME: Record<string, string> = {
  de: "Deutsch",
  en: "English",
  fr: "Français",
  es: "Español",
  it: "Italiano",
  nl: "Nederlands",
  pl: "Polski",
};

function name(code: string): string {
  return EIGENNAME[code] ?? code.toUpperCase();
}

export function Sprachwahl({ aktuell }: { aktuell?: string }) {
  /*
   * Ohne Angabe: die Sprache vom `lang` der Seite nehmen.
   *
   * ── Warum nicht durch acht Dateien gereicht ────────────────────
   *
   * `TopNav` wird an acht Stellen gerendert, und nur zwei davon haben
   * die aufgelöste Sprache überhaupt zur Hand. Die übrigen sechs
   * müssten sie sich holen — sechs neue Aufrufe für eine Beschriftung
   * aus zwei Buchstaben.
   *
   * `document.documentElement.lang` setzt das Wurzellayout aus
   * derselben Entscheidung, die auch die Texte bestimmt. Diese Quelle
   * kann also nicht von dem abweichen, was der Nutzer sieht — eine
   * durchgereichte Eigenschaft schon, sobald jemand sie an einer
   * Stelle vergisst.
   *
   * Der Preis ist ein Zeichenwechsel nach dem ersten Zeichnen. Bei
   * zwei Buchstaben in der Kopfzeile ist das vertretbar; wer ihn
   * vermeiden will, reicht `aktuell` durch.
   */
  const [ausSeite, setAusSeite] = useState<string | null>(null);
  useEffect(() => {
    if (aktuell) return;
    const l = document.documentElement.lang?.slice(0, 2).toLowerCase();
    if (l) setAusSeite(l);
  }, [aktuell]);
  const jetzt = aktuell ?? ausSeite;

  const [offen, setOffen] = useState(false);
  const [laeuft, starten] = useTransition();
  const halter = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const angeboten = VORBEREITETE_SPRACHEN.filter((c) => SPRACHEN_MIT_TEXTEN.includes(c));

  /*
   * Escape schliesst, Klick daneben auch — dieselbe Regel wie bei den
   * Bereichsmenüs. Ein Feld, das nur derselbe Knopf wieder schliesst,
   * ist eine Falle für jeden, der es versehentlich geöffnet hat.
   */
  useEffect(() => {
    if (!offen) return;
    function taste(e: KeyboardEvent) {
      if (e.key === "Escape") setOffen(false);
    }
    function daneben(e: MouseEvent) {
      if (!halter.current?.contains(e.target as Node)) setOffen(false);
    }
    document.addEventListener("keydown", taste);
    document.addEventListener("mousedown", daneben);
    return () => {
      document.removeEventListener("keydown", taste);
      document.removeEventListener("mousedown", daneben);
    };
  }, [offen]);

  /*
   * Eine einzige Sprache ist keine Wahl.
   *
   * Solange es nur einen Katalog gibt, wäre der Knopf ein Menü mit
   * genau einem Eintrag — er verspräche etwas, was er nicht hält.
   */
  if (angeboten.length < 2) return null;
  /* Solange die Sprache nicht feststeht, nichts anzeigen — ein Knopf
     ohne Beschriftung ist schlechter als kein Knopf. */
  if (!jetzt) return null;

  return (
    <div ref={halter} className="relative">
      <button
        type="button"
        aria-expanded={offen}
        aria-label={`Sprache: ${name(jetzt)}`}
        disabled={laeuft}
        onClick={() => setOffen((o) => !o)}
        className="flex h-11 items-center gap-1 rounded-(--radius-control) px-2 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
      >
        {jetzt.toUpperCase()}
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={`size-3 shrink-0 transition-transform ${offen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6.5 8 10.5l4-4" />
        </svg>
      </button>

      {offen ? (
        <div
          role="listbox"
          aria-label="Sprache"
          className="absolute right-0 top-[calc(100%+6px)] z-20 w-max min-w-[9rem] rounded-(--radius-lg) border border-line p-1 shadow-xl"
          style={{ background: "color-mix(in srgb, var(--surface-1) 78%, #000)" }}
        >
          {angeboten.map((code) => (
            <button
              key={code}
              type="button"
              role="option"
              aria-selected={code === jetzt}
              onClick={() =>
                starten(async () => {
                  await spracheWaehlen(code);
                  setOffen(false);
                  /* Neu bewerten, damit die Texte sofort wechseln —
                     ohne dass jemand die Seite selbst neu lädt. */
                  router.refresh();
                })
              }
              className={[
                "flex w-full items-center justify-between gap-4 rounded-(--radius-control) px-3 py-2 text-left text-sm transition-colors",
                "hover:bg-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                code === jetzt ? "font-medium text-ink" : "text-ink-2",
              ].join(" ")}
            >
              {name(code)}
              {code === jetzt ? (
                <svg
                  aria-hidden
                  viewBox="0 0 16 16"
                  className="size-3.5 shrink-0 text-accent-text"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 8.5 6.5 12 13 4.5" />
                </svg>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
