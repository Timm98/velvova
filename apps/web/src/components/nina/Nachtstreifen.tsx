"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useNinaActions } from "./NinaProvider";
import type { NinaVisualState } from "./NinaProvider";
import { cn } from "@/lib/cn";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Zeile unter dem Ring
 * ══════════════════════════════════════════════════════════════════
 *
 * Der Ring hat sechs Animationen und der Nachtlauf fünfzehn Phasen.
 * Für jede Phase eine eigene Bewegung zu erfinden hiesse, Zustände zu
 * zeigen, die das Modell nicht hat. Die Genauigkeit steht deshalb
 * hier, in einer Zeile Text — und der Ring nimmt nur die grobe
 * Richtung an.
 *
 * ── Warum er meistens nichts anzeigt ────────────────────────────
 *
 * Weil meistens nichts läuft. Ein Streifen, der immer etwas sagt,
 * sagt nach drei Tagen nichts mehr. Ohne Lauf ist hier nichts, und
 * der Ring bleibt, wie er war.
 *
 * ── Warum abgefragt und nicht geschoben wird ────────────────────
 *
 * Weil eine dauerhafte Verbindung für eine Zeile, die sich alle paar
 * Minuten ändert, teurer ist als das Problem. Abgefragt wird nur,
 * solange der Reiter sichtbar ist: Ein Rechner, der über Nacht offen
 * steht, soll nicht bis zum Morgen Anfragen schicken.
 */

const TAKT_MS = 30_000;

interface Lage {
  phase: string;
  zeile: string | null;
  ring: NinaVisualState;
  ziel: string | null;
}

export function Nachtstreifen({ className }: { className?: string }) {
  const { setProzess } = useNinaActions();
  const [lage, setLage] = useState<Lage | null>(null);

  useEffect(() => {
    let lebt = true;
    let zeiger: ReturnType<typeof setTimeout> | undefined;

    async function holen() {
      if (document.visibilityState !== "visible") return planen();
      try {
        const antwort = await fetch("/api/nachtlauf/phase", { cache: "no-store" });
        if (!antwort.ok) return planen();
        const daten = (await antwort.json()) as Lage;
        if (!lebt) return;
        setLage(daten.phase === "ruhe" ? null : daten);
        /*
         * Der Ring bekommt den Zustand nur, wenn wirklich etwas läuft.
         * `null` gibt ihn dem Gespräch zurück.
         */
        setProzess(daten.phase === "ruhe" ? null : daten.ring);
      } catch {
        /* Kein Netz heisst nicht „kein Lauf" — die letzte Zeile bleibt
           stehen, statt zu behaupten, es sei nichts. */
      }
      planen();
    }

    function planen() {
      if (lebt) zeiger = setTimeout(holen, TAKT_MS);
    }

    void holen();
    document.addEventListener("visibilitychange", holen);
    return () => {
      lebt = false;
      if (zeiger) clearTimeout(zeiger);
      document.removeEventListener("visibilitychange", holen);
      /* Beim Verlassen den Ring freigeben — sonst hinge er im letzten
         Prozesszustand fest, während das Gespräch weiterläuft. */
      setProzess(null);
    };
  }, [setProzess]);

  if (!lage?.zeile) return null;

  const inhalt = (
    <>
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          lage.phase === "fehler" ? "bg-critical" : "bg-accent",
          lage.phase !== "fehler" && lage.phase !== "bereit" && "animate-pulse",
        )}
      />
      {lage.zeile}
    </>
  );

  return (
    <p
      className={cn(
        "mx-auto flex w-fit items-center gap-2 text-2xs leading-relaxed text-ink-3",
        className,
      )}
      aria-live="polite"
    >
      {lage.ziel ? (
        <Link
          href={lage.ziel}
          className="flex items-center gap-2 text-accent-text underline-offset-4 hover:underline"
        >
          {inhalt}
        </Link>
      ) : (
        inhalt
      )}
    </p>
  );
}
