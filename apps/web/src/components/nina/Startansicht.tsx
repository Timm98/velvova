"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/cn";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Startansicht eines leeren Gesprächs
 * ══════════════════════════════════════════════════════════════════
 *
 * Der Core, ein Name, vier Vorschläge. Mehr nicht.
 *
 * ── Warum die Begrüssung den Namen trägt und nicht die Adresse ──
 *
 * Weil eine E-Mail-Adresse in vierzig Pixel Schriftgrösse keine
 * Begrüssung ist, sondern eine Kennung. „Hallo tim.acc444@…" liest
 * sich wie ein Systemprotokoll.
 *
 * Fehlt der Name, steht dort nur „Hallo". Das ist freundlicher als
 * ein Platzhalter und ehrlicher als ein erfundener Vorname.
 *
 * ── Warum der Core hier steht ───────────────────────────────────
 *
 * An der Stelle, an der bei anderen ein Logo steht. Er ist das
 * Einzige auf dieser Fläche, das Velvova gehört — Schrift und
 * Abstände könnten von überall sein.
 *
 * Er wird nachgeladen: Das Modell ist eine eigene Datei, und sie soll
 * die erste Darstellung nicht aufhalten. Bis sie da ist, steht ein
 * ruhiger Platzhalter derselben Grösse — kein Springen, wenn er
 * eintrifft.
 *
 * ── Warum die Vorschläge nichts senden ──────────────────────────
 *
 * Ein Klick schreibt den Satz ins Eingabefeld, mehr nicht. Wer auf
 * „Bewerbung vorbereiten" tippt, hat sich für ein Thema entschieden,
 * nicht für eine Frage — und eine Nachricht, die ungefragt losgeht,
 * nimmt ihm den Satz aus der Hand, den er gerade formulieren wollte.
 */

const Core = dynamic(() => import("./NinaScene").then((m) => m.NinaScene), {
  ssr: false,
  loading: () => <span aria-hidden className="block size-full rounded-full bg-(--app-erhoben)" />,
});

export function Startansicht({
  displayName,
  className,
}: {
  /** Der Name aus dem Profil. `null` heisst: nur „Hallo". */
  displayName: string | null;
  className?: string;
}) {
  /*
   * Bewegung nur, wenn sie gewollt ist.
   *
   * Der Core dreht sich leise. Für jemanden mit vestibulärer Störung
   * ist das nichts Leises — deshalb fragt diese Zeile das Betriebs-
   * system, statt es zu entscheiden.
   */
  const name = displayName?.trim();

  return (
    <div className={cn("grid justify-items-center gap-7 px-4 text-center", className)}>
      {/*
        ── Der Core links neben dem Namen ────────────────────────
        
        Nicht als Zeile darüber, sondern auf einer Höhe mit der
        Begrüssung. So gehört er zu ihr statt sie anzukündigen — und
        das Wort „Monday" braucht es daneben nicht mehr: Wer angemeldet
        ist, weiss, wo er ist.
      */}
      <div className="flex items-center gap-4">
        <span aria-hidden className="block size-20 shrink-0 sm:size-[112px]">
          {/*
            Still, nicht bewegt.
            
            An der Stelle, an der bei anderen ein Logo steht, erwartet
            das Auge ein Zeichen — keine Animation. Und bei 112 Pixeln
            sieht man die Drehung so deutlich, dass sie wie ein Fehler
            wirkt: Fäden, die sich bei jedem Bild anders anordnen.
            
            Die Bewegung ist nicht verloren. Sie gehört ins Gespräch,
            wo sie etwas bedeutet — Monday denkt, Monday spricht.
          */}
          <Core state="idle" reducedMotion />
        </span>
        {/*
          Kein `font-bold`. Eine Begrüssung, die schreit, wirkt wie
          eine Überschrift auf einer Verkaufsseite.
        */}
        <h1 className="font-titel text-[34px] leading-tight font-medium tracking-tight text-(--app-text) sm:text-[54px]">
          {name ? `Hallo ${name}` : "Hallo"}
        </h1>
      </div>

    </div>
  );
}
