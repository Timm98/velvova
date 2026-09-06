"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AUSSENVERWEISE } from "@paycheck/config";

const SCHLUESSEL = "paycheck_apphinweis_zu";

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
export function AppHinweisleiste() {
  const [sichtbar, setSichtbar] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SCHLUESSEL) !== "1") setSichtbar(true);
    } catch {
      /* Kein Speicher (privates Fenster, gesperrte Seitendaten): dann
         eben immer zeigen. Ein Hinweis ist kein Grund für einen Fehler. */
      setSichtbar(true);
    }
  }, []);

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
      className="border-b border-line bg-sunken"
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
        <p className="min-w-0 flex-1 truncate text-center">
          {hatApp ? (
            <>Velvova auch unterwegs — Nina begleitet dich überall.</>
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
              window.localStorage.setItem(SCHLUESSEL, "1");
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
