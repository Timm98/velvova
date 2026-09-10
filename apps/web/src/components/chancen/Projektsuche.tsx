"use client";

import { useState, useTransition } from "react";
import { Search, Play, Loader2 } from "lucide-react";
import { sucheEinrichten, sucheStarten } from "@/lib/chancen/sucheaktionen";
import { cn } from "@/lib/cn";

/**
 * Der Zustand der Suche eines Vorhabens — und der nächste Schritt.
 *
 * Drei Lagen, drei verschiedene Sätze:
 *
 *   keine     Es gibt keinen Suchauftrag. Das ist NICHT „nichts
 *             gefunden" — deshalb steht hier auch nichts über Treffer.
 *   entwurf   Kriterien liegen vor, niemand hat sie bestätigt. Die
 *             Suche läuft nicht.
 *   aktiv     Sie läuft. Stündlich, und die Treffer stehen unten.
 *
 * ── Warum „keine" nicht wie ein Fehler aussieht ─────────────────
 *
 * Weil es keiner ist. Ein Vorhaben ohne Suche ist der Normalzustand,
 * solange das Ziel zu unbestimmt für Kriterien war. Ein rotes
 * Ausrufezeichen dort hiesse, jemand hätte etwas falsch gemacht.
 */

const KNOPF =
  "inline-flex min-h-10 items-center gap-2 rounded-(--radius-control) px-3.5 text-[14px] font-medium transition-colors disabled:opacity-60";

export function Projektsuche({
  projektId,
  suche,
}: {
  projektId: string;
  suche: { id: string; name: string; status: string; laeuftSeit: Date | null } | null;
}) {
  const [laeuft, uebergang] = useTransition();
  const [meldung, setMeldung] = useState<string | null>(null);

  /* Läuft sie, ist hier nichts zu tun. Ein Knopf ohne Handlung wäre
     ein Angebot, das nichts bedeutet. */
  if (suche && suche.status === "aktiv") {
    return (
      <p className="flex items-center gap-2 text-[14px] text-(--app-text-2)">
        <Search className="size-4 shrink-0 text-(--app-text-3)" strokeWidth={1.8} />
        Monday sucht laufend danach
        {suche.laeuftSeit && (
          <span className="text-(--app-text-3)">
            · seit {suche.laeuftSeit.toLocaleDateString("de-DE")}
          </span>
        )}
      </p>
    );
  }

  if (suche) {
    return (
      <div className="grid gap-2">
        <p className="text-[14px] text-(--app-text-2)">
          Die Suche ist eingerichtet, aber sie läuft noch nicht.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={laeuft}
            onClick={() =>
              uebergang(async () => {
                const a = await sucheStarten(projektId, suche.id);
                setMeldung(a.ok ? null : "Die Suche liess sich nicht starten.");
              })
            }
            className={cn(KNOPF, "bg-accent text-accent-on hover:opacity-90")}
          >
            {laeuft ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            ) : (
              <Play className="size-4" strokeWidth={2} />
            )}
            Suche starten
          </button>
          <a
            href={`/app/suchauftraege`}
            className="text-[14px] text-(--app-text-3) underline underline-offset-[3px] hover:text-(--app-text-2)"
          >
            Kriterien ansehen
          </a>
        </div>
        {meldung && <p className="text-[13px] text-(--app-fehler)">{meldung}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <p className="text-[14px] text-(--app-text-2)">
        Für dieses Vorhaben läuft noch keine Suche.
      </p>
      <button
        type="button"
        disabled={laeuft}
        onClick={() =>
          uebergang(async () => {
            const a = await sucheEinrichten(projektId);
            if (a.ok) {
              setMeldung(null);
              return;
            }
            /*
             * Die Gründe tragen eigene Worte. „Fehler" würde drei
             * verschiedene Lagen zu einer machen, und nur eine davon
             * kann die Person selbst beheben.
             */
            setMeldung(
              a.grund === "kein_ziel"
                ? "Das Ziel ist noch zu knapp. Sag Monday im Gespräch genauer, was du suchst."
                : a.grund === "kein_modell"
                  ? "Dafür ist gerade kein Modell freigegeben."
                  : "Aus dem Ziel liessen sich keine Kriterien ableiten.",
            );
          })
        }
        className={cn(
          KNOPF,
          "w-fit border border-(--app-rand) text-(--app-text) hover:bg-(--app-hover)",
        )}
      >
        {laeuft ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
        ) : (
          <Search className="size-4" strokeWidth={1.8} />
        )}
        Suche aus dem Ziel ableiten
      </button>
      {meldung && <p className="text-[13px] text-(--app-text-3)">{meldung}</p>}
    </div>
  );
}
