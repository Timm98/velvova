"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AUSSENVERWEISE } from "@paycheck/config";
import { cn } from "@/lib/cn";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Leiste unter dem Eingabefeld
 * ══════════════════════════════════════════════════════════════════
 *
 * Eine durchgehende Fläche, keine Reihe einzelner Pillen.
 *
 * ── Warum eine Leiste und nicht zwei Abzeichen ──────────────────
 *
 * Zwei umrandete Pillen nebeneinander sind zwei Angebote: Jede hat
 * einen eigenen Rand, also eine eigene Grenze, also eine eigene
 * Bedeutung. Das Auge zählt sie und fragt bei jeder, ob sie wichtig
 * ist.
 *
 * Eine Leiste ist eine Sache — der Fuss des Eingabefelds. Sie ist
 * etwas schmaler als das Feld und schiebt sich hinter dessen untere
 * Kante, damit sie daran hängt, statt darunter zu schweben. Ohne
 * diese Überlappung sähe man ihre abgerundete Oberkante, und aus dem
 * Fuss würde eine zweite Karte.
 *
 * Sie ist dunkler als das Feld und heller als der Grund: Damit steht
 * sie hinter dem Feld, ohne im Hintergrund zu verschwinden.
 *
 * ── Warum das Desktop-Abzeichen kein Verweis ist ────────────────
 *
 * Weil es die Datei noch nicht gibt. `desktopUrl` steht auf `null`,
 * und die öffentliche Seite macht daraus bereits „kommt bald" statt
 * eines Verweises. Dieselbe Entscheidung gilt hier: Ein Eintrag, der
 * ins Leere führt, ist schlimmer als keiner.
 *
 * Sobald dort eine Adresse steht, wird aus dem Hinweis ein
 * Herunterladen, ohne dass jemand diese Datei anfassen muss.
 */

/**
 * Welches System sitzt davor?
 *
 * Erst nach dem ersten Zeichnen, nicht währenddessen: Der Server
 * kennt das Gerät nicht, und ein Zeichen, das sich beim Hydrieren
 * ändert, ist ein Fehler in der Konsole und ein Zucken im Bild.
 */
function system(): "mac" | "windows" | "andere" {
  if (typeof navigator === "undefined") return "andere";
  const p = `${navigator.platform ?? ""} ${navigator.userAgent ?? ""}`.toLowerCase();
  if (/mac|iphone|ipad/.test(p)) return "mac";
  if (/win/.test(p)) return "windows";
  return "andere";
}

/* Die Zeichen als Pfade, nicht als Bibliothek: lucide führt keine
   Markenlogos mehr, und ein Paket für zwei Symbole zu laden wäre
   mehr Abhängigkeit als Nutzen. */
function Apfel() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0" fill="currentColor">
      <path d="M16.3 12.9c0-2.2 1.8-3.3 1.9-3.4-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.4.8-.7 0-1.8-.8-2.9-.8-1.5 0-2.9.9-3.7 2.2-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.3 2.7 2.3 1.1 0 1.5-.7 2.8-.7s1.7.7 2.9.7c1.2 0 2-1.1 2.7-2.2.9-1.2 1.2-2.5 1.2-2.5 0 0-2.3-.9-2.3-3.7zM14.1 6c.6-.7 1-1.7.9-2.7-.9 0-2 .6-2.6 1.3-.6.6-1.1 1.7-.9 2.6 1 .1 2-.5 2.6-1.2z" />
    </svg>
  );
}

function Fenster() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="size-4 shrink-0" fill="currentColor">
      <path d="M3 5.6l7.3-1v6.9H3V5.6zm8.5-1.2L21 3v8.5h-9.5V4.4zM3 12.7h7.3v6.9L3 18.5v-5.8zm8.5 0H21V21l-9.5-1.3v-7z" />
    </svg>
  );
}

/*
 * Die echten Markenzeichen, aus `public/marken/`.
 *
 * ── Warum `img` und nicht `next/image` ──────────────────────────
 *
 * Weil hier zwanzig Pixel dargestellt werden. Der Bildoptimierer
 * legt für jede Grösse eine eigene Fassung an, hält sie vor und
 * liefert sie über eine eigene Route — für ein Zeichen in einer
 * Kachel ist das mehr Maschinerie als Bild.
 *
 * Farbig, nicht eingefärbt: Ein Markenzeichen in fremder Farbe ist
 * keines mehr. Beide stehen hier als Wegweiser, nicht als Zierde.
 *
 * Die Reihenfolge ist die Stapelreihenfolge: Was später kommt, liegt
 * oben. Outlook zuerst, Gmail darüber.
 *
 * ── Warum `width` und `height` als Attribut ────────────────────
 *
 * Weil ein Bild ohne Mass so gross ist, wie die Datei es sagt —
 * hier 128 Pixel, in der Vorgängerfassung 515. Solange die Grösse
 * nur in einer Klasse steht, hängt sie an einer CSS-Datei, die im
 * Entwicklungsbetrieb unter gleichem Namen ausgeliefert wird und
 * deshalb im Browser hängenbleiben kann. Dann trifft neues Markup
 * auf altes CSS, keine Regel greift, und das Logo füllt die halbe
 * Seite. Genau das ist passiert.
 *
 * Das Attribut ist HTML. Es gilt auch, wenn kein Stylesheet da ist.
 */
const MARKEN = [
  { name: "Outlook", bild: "/marken/outlook-2025.png" },
  { name: "Gmail", bild: "/marken/gmail-m.png" },
] as const;

/* Ein Eintrag in der Leiste: Zeichen, Wort, sonst nichts. Kein
   eigener Rand — der Rand ist die Leiste. */
const EINTRAG = "inline-flex items-center gap-2 text-sm leading-none";

export function Startabzeichen({ className }: { className?: string }) {
  const desktop = AUSSENVERWEISE.desktopUrl;
  const [wo, setWo] = useState<"mac" | "windows" | "andere">("andere");
  useEffect(() => setWo(system()), []);
  const Zeichen = wo === "mac" ? Apfel : wo === "windows" ? Fenster : null;

  return (
    <div
      /*
        Die beiden Maße stehen hier und nicht in einer Klasse.

        `-mt-6` und `max-w-2xl` kommen sonst nirgends in der App vor.
        Tailwind erzeugt nur Klassen, die tatsächlich benutzt werden —
        eine CSS-Datei von vorher kennt sie also nicht. Und weil
        Turbopack im Entwicklungsbetrieb unter gleichbleibendem
        Dateinamen ausliefert, hält der Browser sie fest. Dann fällt
        genau die Breite weg und genau die Überlappung, und die Leiste
        wird zu breit und zu hoch — dasselbe Muster wie bei den Logos,
        die ohne `width` in Dateigrösse erschienen.

        24 Pixel liegen hinter der Eingabe, sichtbar bleiben die 44
        der Zeile. 680 sind 94,4 % der 720 des Feldes — das Verhältnis
        aus der Vorlage. Der Radius steht auf 26; unten klemmt der
        Browser ihn auf die halbe sichtbare Höhe, die Unterkante wird
        also so rund, wie sie bei 44 Pixeln werden kann.
      */
      style={{
        marginTop: -24,
        maxWidth: 680,
        borderRadius: 26,
        /*
          Durchscheinend, aber mit Kante.

          Bei 55 % steht die Fläche nicht mehr als eigene Karte da,
          sondern als Schatten des Feldes darüber. Was dann fehlt, ist
          die Grenze: Eine halbdurchsichtige Fläche auf fast gleich
          dunklem Grund hat keinen Rand mehr, den das Auge findet.
          Deshalb bleibt der Strich — er trägt jetzt die Form, nicht
          mehr die Füllung.
        */
        background: "color-mix(in oklab, var(--app-erhoben) 55%, transparent)",
        border: "1px solid var(--app-rand)",
      }}
      className={cn("relative z-0 mx-auto w-full pt-6", className)}
    >
      <div className="flex items-center justify-between gap-4 px-5" style={{ height: 44 }}>
        {/*
          ── Ein Wort, zwei Zeichen ────────────────────────────────

          „Plugins" sagt, worum es geht; die beiden Zeichen davor
          sagen, welche. Überlappend gestapelt: Der Stapel wächst mit
          jedem weiteren Dienst, ohne dass die Zeile breiter wird.

          Jedes Zeichen sitzt in einer eigenen Kachel in der Farbe des
          Eingabefelds. Die Kachel ist die Trennung — ohne sie
          verschmelzen zwei überlappende Logos zu einem Fleck.
        */}
        <Link
          href="/app/plugins"
          className={cn(
            EINTRAG,
            "text-(--app-text-2) transition-colors hover:text-(--app-text)",
            "rounded-(--radius-control) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--app-fokus)",
          )}
        >
          <span className="flex items-center">
            {MARKEN.map((marke, i) => (
              <span
                key={marke.name}
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-lg bg-(--app-eingabe)",
                  i > 0 && "-ml-1.5",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={marke.bild}
                  alt={marke.name}
                  width={24}
                  height={24}
                  className="size-6 object-contain"
                />
              </span>
            ))}
          </span>
          Plugins
        </Link>

        {desktop ? (
          <a
            href={desktop}
            className={cn(
              EINTRAG,
              "text-(--app-text-2) transition-colors hover:text-(--app-text)",
              "rounded-(--radius-control) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--app-fokus)",
            )}
          >
            {Zeichen && <Zeichen />}
            Desktop-App herunterladen
          </a>
        ) : (
          /* Kein Verweis, solange es nichts zu holen gibt. Dasselbe tut
             die öffentliche Seite mit demselben Wert. */
          <span className={cn(EINTRAG, "cursor-default text-(--app-text-3)")}>
            {Zeichen && <Zeichen />}
            Desktop-App: kommt bald
          </span>
        )}
      </div>
    </div>
  );
}
