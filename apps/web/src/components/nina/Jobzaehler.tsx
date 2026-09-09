"use client";

import { useEffect, useState } from "react";
import { Database } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * ══════════════════════════════════════════════════════════════════
 * Wie viele Stellen tatsächlich da sind
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Warum nicht „Live" ──────────────────────────────────────────
 *
 * Weil der Bestand nicht live ist. Er wird stündlich vorberechnet und
 * liegt als Kennzahl in der Datenbank. „Live" neben einer Zahl, die
 * fünfzig Minuten alt sein kann, ist eine kleine Lüge mit grosser
 * Wirkung: Sie lädt dazu ein, der Zahl mehr zu glauben, als sie
 * hergibt.
 *
 * Deshalb „Aktive Stellen" und beim Aufklappen der Zeitpunkt dazu.
 *
 * ── Warum vier Zustände und nicht zwei ──────────────────────────
 *
 * Weil „lädt", „veraltet", „Fehler" und „tatsächlich null" vier
 * verschiedene Dinge sind und nur einer davon bedeutet, dass es keine
 * Stellen gibt. Ein Fehler, der als „0 Jobs" erscheint, ist die
 * schlimmste Verwechslung von allen — er sieht aus wie eine Aussage
 * über den Markt.
 *
 * ── Warum das den Composer nicht aufhält ────────────────────────
 *
 * Der Abruf läuft nach dem ersten Zeichnen. Solange er läuft, steht
 * hier nichts; das Feld daneben ist von der ersten Sekunde an
 * benutzbar. Eine Eingabe, die auf eine Zahl wartet, die niemand
 * braucht, wäre der teuerste Ladebalken der Anwendung.
 */

type Lage =
  | { art: "laedt" }
  | { art: "da"; genau: number; stand: string | null }
  | { art: "fehler" };

/** Tausenderpunkte, deutsche Schreibweise. */
function zahl(n: number): string {
  return n.toLocaleString("de-DE");
}

function alter(stand: string | null): { text: string; veraltet: boolean } {
  if (!stand) return { text: "Zeitpunkt unbekannt", veraltet: true };
  const minuten = Math.floor((Date.now() - new Date(stand).getTime()) / 60_000);
  if (minuten < 0) return { text: "gerade eben", veraltet: false };
  if (minuten < 90) return { text: `vor ${minuten} Min. geprüft`, veraltet: false };
  const stunden = Math.floor(minuten / 60);
  if (stunden < 48) return { text: `vor ${stunden} Std. geprüft`, veraltet: stunden > 6 };
  return { text: `vor ${Math.floor(stunden / 24)} Tagen geprüft`, veraltet: true };
}

export function Jobzaehler({ className }: { className?: string }) {
  const [lage, setLage] = useState<Lage>({ art: "laedt" });
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    let abgebrochen = false;
    fetch("/api/bestand")
      .then((a) => (a.ok ? a.json() : Promise.reject(new Error(String(a.status)))))
      .then((d: { genau?: number; stand?: string | null }) => {
        if (abgebrochen) return;
        /*
         * `genau` muss eine Zahl sein. Ein fehlendes Feld als 0 zu
         * lesen wäre genau der Fehler, den die vier Zustände oben
         * verhindern sollen.
         */
        if (typeof d.genau !== "number" || !Number.isFinite(d.genau)) {
          setLage({ art: "fehler" });
          return;
        }
        setLage({ art: "da", genau: d.genau, stand: d.stand ?? null });
      })
      .catch(() => {
        if (!abgebrochen) setLage({ art: "fehler" });
      });
    return () => {
      abgebrochen = true;
    };
  }, []);

  /* Solange nichts feststeht, steht hier nichts. Kein Platzhalter,
     der später seine Breite ändert und die Zeile springen lässt. */
  if (lage.art === "laedt") return null;

  if (lage.art === "fehler") {
    return (
      <span
        className={cn("text-2xs text-(--app-text-3)", className)}
        title="Der Bestand liess sich nicht abrufen. Das sagt nichts darüber, wie viele Stellen es gibt."
      >
        Bestand nicht abrufbar
      </span>
    );
  }

  const { text, veraltet } = alter(lage.stand);

  return (
    <span className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className={cn(
          "flex min-h-8 items-center gap-1.5 rounded-(--radius-pill) px-2 text-xs transition-colors",
          "text-(--app-text-3) hover:bg-(--app-hover) hover:text-(--app-text-2)",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--app-fokus)",
        )}
      >
        <Database className="size-3.5 shrink-0" strokeWidth={1.8} />
        <span className="font-mono tabular-nums">{zahl(lage.genau)}</span>
      </button>

      {offen && (
        <span
          role="status"
          className="absolute bottom-[calc(100%+0.4rem)] left-0 z-50 block w-64 rounded-(--radius-lg) border border-(--app-rand) bg-(--app-erhoben) p-3 text-2xs leading-relaxed text-(--app-text-2) shadow-xl"
        >
          <strong className="block pb-1 font-medium text-(--app-text)">
            {zahl(lage.genau)} aktive Stellen im Bestand
          </strong>
          Entdoppelt, noch nicht abgelaufen, für die Suche verfügbar.
          {" "}
          {/*
            Der Zeitpunkt steht dabei, nicht darunter versteckt: Eine
            Zahl ohne Alter ist eine Behauptung über jetzt.
          */}
          <span className={veraltet ? "text-(--app-fehler)" : undefined}>{text}</span>.
          <span className="block pt-1.5 text-(--app-text-3)">
            Wie viele davon zu dir passen, steht im jeweiligen Projekt.
          </span>
        </span>
      )}
    </span>
  );
}
