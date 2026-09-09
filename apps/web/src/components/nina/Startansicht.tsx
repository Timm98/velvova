"use client";

import { useEffect, useState } from "react";
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

/** Vier Anfänge. Nicht acht — eine Liste, die man liest, statt sie zu überfliegen. */
const VORSCHLAEGE = [
  { text: "Jobs finden", eingabe: "Ich suche einen neuen Job. Wo fange ich an?" },
  { text: "Stellenanzeige prüfen", eingabe: "Ich habe eine Stellenanzeige gefunden. Kannst du sie einordnen?" },
  { text: "Bewerbung vorbereiten", eingabe: "Ich möchte mich bewerben. Was brauche ich dafür?" },
  { text: "Karriere planen", eingabe: "Ich überlege, wie es beruflich weitergehen soll." },
] as const;

export function Startansicht({
  displayName,
  onVorschlag,
  className,
}: {
  /** Der Name aus dem Profil. `null` heisst: nur „Hallo". */
  displayName: string | null;
  onVorschlag: (eingabe: string) => void;
  className?: string;
}) {
  /*
   * Bewegung nur, wenn sie gewollt ist.
   *
   * Der Core dreht sich leise. Für jemanden mit vestibulärer Störung
   * ist das nichts Leises — deshalb fragt diese Zeile das Betriebs-
   * system, statt es zu entscheiden.
   */
  const [ruhig, setRuhig] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setRuhig(m.matches);
    const hoeren = () => setRuhig(m.matches);
    m.addEventListener("change", hoeren);
    return () => m.removeEventListener("change", hoeren);
  }, []);

  const name = displayName?.trim();

  return (
    <div className={cn("grid justify-items-center gap-7 px-4 text-center", className)}>
      <div className="flex items-center gap-4">
        <span aria-hidden className="block size-[52px] shrink-0">
          <Core state="idle" reducedMotion={ruhig} />
        </span>
        {/*
          Kein `font-bold`. Die Vorlage trägt hier ein normales bis
          mittleres Gewicht — eine Begrüssung, die schreit, wirkt wie
          eine Überschrift auf einer Verkaufsseite.
        */}
        <h1 className="font-titel text-[26px] leading-tight font-medium tracking-tight text-(--app-text) sm:text-[38px]">
          {name ? `Hallo ${name}` : "Hallo"}
        </h1>
      </div>

      <ul className="flex flex-wrap justify-center gap-2">
        {VORSCHLAEGE.map((v) => (
          <li key={v.text}>
            <button
              type="button"
              onClick={() => onVorschlag(v.eingabe)}
              className={cn(
                "min-h-9 rounded-(--radius-pill) border border-(--app-rand) px-3.5 text-[13px] text-(--app-text-2)",
                "transition-colors hover:border-(--app-rand-stark) hover:bg-(--app-hover) hover:text-(--app-text)",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--app-fokus)",
              )}
            >
              {v.text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
