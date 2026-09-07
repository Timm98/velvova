"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AUSSENVERWEISE } from "@paycheck/config";

/*
 * ══════════════════════════════════════════════════════════════
 * Zwei Mitteilungen, zwei Schlüssel
 * ══════════════════════════════════════════════════════════════
 *
 * Es gab einen Schlüssel für die ganze Leiste. Solange sie nur die
 * App ankündigte, war das richtig.
 *
 * Seit dort auch die nächtliche Suche steht, war es falsch: Wer die
 * App-Ankündigung einmal weggeklickt hatte, bekam den Hinweis auf die
 * nächtliche Suche nie zu sehen — eine Mitteilung, die es damals
 * noch gar nicht gab, war im Voraus abbestellt.
 *
 * Wer eine wegklickt, klickt eine weg.
 */
const SCHLUESSEL_APP = "paycheck_apphinweis_zu";
const SCHLUESSEL_NACHTS = "paycheck_nachtshinweis_zu";

/**
 * Die schmale Leiste über der Navigation.
 *
 * ── Warum sie nicht wie Werbung aussieht ──────────────────────
 *
 * Weil sie keine ist. Es gibt noch keine App; ein Abzeichen mit
 * „Jetzt im App Store" wäre eine Behauptung, und der erste Klick
 * würde sie widerlegen. Was dasteht, ist eine Ankündigung — und die
 * darf leise sein.
 *
 * ── Warum sie sich schliessen lässt ───────────────────────────
 *
 * Ein Hinweis, den man nicht loswird, ist ein Banner. Geschlossen
 * bleibt sie geschlossen: im Browser gemerkt, nicht bei jedem
 * Seitenwechsel neu.
 *
 * ── Warum sie erst nach dem ersten Rendern erscheint ──────────
 *
 * Der gemerkte Zustand liegt im Browser, der Server kennt ihn nicht.
 * Sie sofort zu zeigen und dann wegzunehmen wäre ein Springen der
 * ganzen Seite — schlimmer als ein Moment ohne Leiste.
 */
export function AppHinweisleiste({
  nachtsZiel = null,
}: {
  /**
   * Wohin „Hier entdecken" führt — oder `null` für: nicht zeigen.
   *
   * ══════════════════════════════════════════════════════════════
   * Warum ein Ziel und kein Wahrheitswert
   * ══════════════════════════════════════════════════════════════
   *
   * Weil das Ziel je nach Ort ein anderes ist: Auf der Startseite
   * wäre es ein Anker auf den Abschnitt darunter, in der Anwendung
   * die Seite, auf der man den Auftrag wirklich einrichtet.
   *
   * Und weil ein Link, dessen Ziel es nicht gibt, beim Klick nichts
   * tut — das ist schlimmer als kein Link. Wer die Leiste einbindet,
   * weiss, wohin sie führen soll; die Leiste selbst weiss es nicht.
   */
  nachtsZiel?: string | null;
} = {}) {
  const schluessel = nachtsZiel ? SCHLUESSEL_NACHTS : SCHLUESSEL_APP;
  const [sichtbar, setSichtbar] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(schluessel) !== "1") setSichtbar(true);
      else setSichtbar(false);
    } catch {
      /* Kein Speicher (privates Fenster, gesperrte Seitendaten): dann
         eben immer zeigen. Ein Hinweis ist kein Grund für einen Fehler. */
      setSichtbar(true);
    }
  }, [schluessel]);

  if (!sichtbar) return null;

  const hatApp = Boolean(AUSSENVERWEISE.iosUrl || AUSSENVERWEISE.androidUrl);
  const ziel = AUSSENVERWEISE.iosUrl ?? AUSSENVERWEISE.androidUrl ?? AUSSENVERWEISE.appInfoUrl;

  return (
    <div
      /*
       * Immer dunkelblau, unabhängig vom gewählten Farbschema.
       *
       * `data-theme="dark"` steht hier am Container, nicht an der
       * Wurzel: Damit lösen *alle* Farbtoken darin — Fläche, Schrift,
       * Ränder, Trennlinien — geschlossen die dunkle Palette auf.
       *
       * Der naheliegende Weg wäre gewesen, nur den Hintergrund fest zu
       * setzen. Dann stünde im hellen Modus die helle Textfarbe auf
       * dunklem Grund, und man flickt anschliessend jeder Zeile,
       * jedem Rahmen und jedem Zustand einzeln hinterher. Das Token-
       * System kann genau das, wofür es gebaut ist: einen Teilbaum
       * umschalten.
       */
      data-theme="dark"
      /*
       * `uebergang-band`: Beim Seitenwechsel bleibt diese Leiste
       * stehen.
       *
       * Sie gehört zum Gerüst und nicht zur Seite — sie steht auf
       * beiden. Ohne eigenen `view-transition-name` gehört sie zum
       * Wurzelbild und fährt mit: In der Aufnahme vom 7. September
       * stand sie mitten auf dem Bildschirm, quer über dem Gespräch,
       * während darunter die Stellenseite hereinkam. Das war der
       * auffälligste Fehler der ganzen Bewegung.
       *
       * Mit eigenem Namen ist sie eine eigene Gruppe. Sie steht auf
       * beiden Seiten an derselben Stelle, also rechnet der Browser
       * keine Bewegung für sie aus.
       */
      className="uebergang-band border-b border-line bg-sunken"
    >
      <div className="mx-auto flex h-8 w-full max-w-(--breite-inhalt) items-center gap-3 px-5 text-2xs font-medium text-ink sm:h-9">
        {/*
          Die Ankündigung steht mittig, nicht am linken Rand.

          Sie ist die einzige Zeile in dieser Leiste und keine
          Navigation — links angeschlagen sah sie aus wie ein
          Systemhinweis, den man wegklickt. Mittig ist sie das, was sie
          sein soll: eine Mitteilung an alle.

          Der Schliessknopf bleibt rechts und wird durch einen gleich
          breiten Blindraum links ausgeglichen, sonst sässe der Text um
          die halbe Knopfbreite verschoben und wäre nur *fast* mittig —
          was auffälliger ist als deutlich daneben.
        */}
        <span aria-hidden className="size-6 shrink-0" />
        {/*
          Zwei Mitteilungen in einer Zeile — und die wichtigere zuerst.

          ══════════════════════════════════════════════════════════
          Warum die nächtliche Suche vor der App steht
          ══════════════════════════════════════════════════════════

          Weil sie etwas ist, das es GIBT. „Die App kommt bald" ist
          ein Versprechen; „Monday sucht über Nacht" ist eine Funktion,
          die man einen Klick später sieht.

          Eine zweite Leiste darüber wäre die falsche Antwort gewesen:
          Zwei schmale Bänder übereinander sind kein Hinweis mehr,
          sondern ein Vorbau vor der Seite.
        */}
        <p className="min-w-0 flex-1 truncate text-center">
          {/*
            Entweder die nächtliche Suche — oder die App.

            ══════════════════════════════════════════════════════
            Warum nicht beides
            ══════════════════════════════════════════════════════

            Wer die nächtliche Suche noch nicht eingerichtet hat, dem
            nützt sie mehr als eine Ankündigung: Sie existiert, sie
            ist einen Klick entfernt, und sie ist der Kern des
            Produkts.

            Wer sie hat, braucht den Hinweis nicht mehr. Dann bleibt
            die eine Mitteilung, die auch für ihn neu ist.

            Zwei Zeilen nebeneinander wären in einer 32 Pixel hohen
            Leiste ohnehin abgeschnitten — und die Person müsste
            entscheiden, welche der beiden gemeint ist.
          */}
          {nachtsZiel ? (
            <>
              <span className="hidden sm:inline">Monday sucht automatisch über Nacht. </span>
              <a href={nachtsZiel} className="underline underline-offset-[3px] hover:text-ink">
                Hier entdecken
              </a>
            </>
          ) : hatApp ? (
            <>Velvova auch unterwegs — Monday begleitet dich überall.</>
          ) : (
            <>
              <span className="hidden sm:inline">Velvova auch unterwegs: </span>
              Die App kommt bald.
            </>
          )}
          {ziel && (
            <>
              {" "}
              <a href={ziel} className="underline underline-offset-[3px] hover:text-ink">
                Mehr erfahren
              </a>
            </>
          )}
        </p>

        <button
          type="button"
          aria-label="Hinweis schliessen"
          onClick={() => {
            setSichtbar(false);
            try {
              window.localStorage.setItem(schluessel, "1");
            } catch {
              /* Ohne Speicher kommt sie beim nächsten Laden wieder. Das
                 ist unschön und harmlos — ein Fehler wäre schlimmer. */
            }
          }}
          className="grid size-6 shrink-0 place-items-center rounded-(--radius-sm) text-ink-3 transition-colors hover:bg-soft hover:text-ink"
        >
          <X className="size-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
