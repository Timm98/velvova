"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { useNinaFallsVorhanden } from "./NinaProvider";
import { cn } from "@/lib/cn";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die Modellwahl — Monday bleibt die Marke
 * ══════════════════════════════════════════════════════════════════
 *
 * Für den Menschen vor dem Bildschirm gibt es Monday. OpenAI,
 * Anthropic und Google sind Zulieferer, und sie tauchen an genau
 * einer Stelle auf: hier, als Überschriften in einer Liste, die man
 * öffnen muss.
 *
 * Deshalb keine Logos, keine Farben der Anbieter, kein Wechsel des
 * Erscheinungsbildes je nach Modell. Ein Chip in der Schrift der
 * Seite, unten rechts, kleiner als alles andere.
 *
 * ── Was der Chip zeigt und was er nicht behauptet ───────────────
 *
 *   Automatisch            noch nichts gelaufen
 *   Auto · GPT-5           das hat gerade geantwortet
 *   Claude Fable 5.1       so ist es eingestellt
 *
 * Der mittlere Fall ist der wichtige. Der Name kommt aus den
 * Nutzungsdaten des Anbieters, nicht aus unserer Konfiguration —
 * sonst stünde dort bei einem Ausweichmodell der falsche.
 *
 * ── Warum die Liste erst beim Öffnen geladen wird ───────────────
 *
 * Weil sie auf jeder Seite mit einem Eingabefeld steht und fast nie
 * geöffnet wird. Ein Abruf beim Zeichnen wäre einer je Seitenaufruf,
 * für eine Liste, die niemand ansieht.
 */

interface Modelleintrag {
  id: string;
  name: string;
  beschreibung: string;
  vorschau: boolean;
  /** Ob dieses Modell eine Denkintensität kennt. Vom Server. */
  denktiefe?: boolean;
}

interface Gruppe {
  anbieter: string;
  name: string;
  modelle: Modelleintrag[];
}

interface Auskunft {
  auto: { id: string; name: string; beschreibung: string };
  gruppen: Gruppe[];
  auswahlMoeglich: boolean;
}

export function Modellwahl({ className }: { className?: string }) {
  /*
   * `useNina()` würde ausserhalb des Providers werfen — zu Recht, denn
   * dort gibt es kein Gespräch. Der Composer steht aber auch an
   * solchen Stellen. Ohne Provider zeichnet die Wahl deshalb nichts:
   * Ein Chip, der ein Modell für ein Gespräch wählt, das es nicht
   * gibt, wäre eine Schaltfläche ohne Wirkung.
   */
  const nina = useNinaFallsVorhanden();

  const [offen, setOffen] = useState(false);
  const [auskunft, setAuskunft] = useState<Auskunft | null>(null);
  const [laedt, setLaedt] = useState(false);
  const huelle = useRef<HTMLDivElement>(null);

  /* Erst beim Öffnen, und nur einmal. */
  useEffect(() => {
    if (!offen || auskunft || laedt) return;
    setLaedt(true);
    fetch("/api/monday/models")
      .then((a) => (a.ok ? (a.json() as Promise<Auskunft>) : null))
      .then((d) => setAuskunft(d))
      .catch(() => setAuskunft(null))
      .finally(() => setLaedt(false));
  }, [offen, auskunft, laedt]);

  useEffect(() => {
    if (!offen) return;
    function daneben(e: MouseEvent) {
      if (!huelle.current?.contains(e.target as Node)) setOffen(false);
    }
    function taste(e: KeyboardEvent) {
      if (e.key === "Escape") setOffen(false);
    }
    document.addEventListener("mousedown", daneben);
    document.addEventListener("keydown", taste);
    return () => {
      document.removeEventListener("mousedown", daneben);
      document.removeEventListener("keydown", taste);
    };
  }, [offen]);

  /*
   * Der Ausstieg steht hier und nicht oben: Alle Haken müssen bei
   * jedem Zeichnen in derselben Reihenfolge laufen, sonst bricht
   * React ab.
   */
  if (!nina) return null;
  const { modell, zuletztesModell, setModell, denktiefe, setDenktiefe } = nina;

  const alle = auskunft?.gruppen.flatMap((g) => g.modelle) ?? [];
  const gewaehlt = alle.find((m) => m.id === modell);

  /*
   * Die Beschriftung.
   *
   * Bei manueller Wahl steht der Name da, sobald wir ihn kennen —
   * vorher die Kennung. Das ist unschön und ehrlich: Der Name kommt
   * vom Server, und bevor die Liste geladen ist, haben wir ihn nicht.
   */
  const beschriftung =
    modell === "auto"
      ? zuletztesModell
        ? `Auto · ${zuletztesModell}`
        : "Automatisch"
      : (gewaehlt?.name ?? modell);

  return (
    <div ref={huelle} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={offen}
        aria-label="Modell wählen"
        className={cn(
          /*
           * Sichtbar, aber nicht laut.
           *
           * Der Chip stand in `text-2xs` und der schwächsten Textstufe
           * — man musste wissen, dass er da ist, um ihn zu finden. Das
           * gewählte Modell ist aber die Angabe, die man beim Blick
           * auf die Eingabe zuerst sucht: Wer antwortet mir gerade?
           *
           * Eine Stufe grösser, eine Stufe heller, und ein Rand beim
           * Überfahren. Kein Kasten im Ruhezustand: Er soll ablesbar
           * sein, nicht um Aufmerksamkeit bitten.
           */
          "flex max-w-[18rem] min-h-8 items-center gap-1.5 rounded-(--radius-pill) px-2.5",
          "text-xs text-(--app-text-2) transition-colors",
          "hover:bg-(--app-hover) hover:text-(--app-text)",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--app-fokus)",
          offen && "bg-(--app-hover) text-(--app-text)",
        )}
      >
        <Sparkles className="size-3 shrink-0" strokeWidth={1.9} />
        <span className="truncate">{beschriftung}</span>
        <ChevronDown
          className={cn("size-3 shrink-0 transition-transform", offen && "rotate-180")}
          strokeWidth={1.9}
        />
      </button>

      {offen && (
        /* Nach oben: Der Chip sitzt am unteren Rand des Eingabefelds. */
        <div
          role="menu"
          className={cn(
            /*
             * ── Schreibtisch: über dem Chip, rechtsbündig ─────────
             */
            "absolute right-0 bottom-[calc(100%+0.4rem)] z-50 max-h-[60dvh] w-[21rem]",
            "overflow-y-auto rounded-(--radius-lg) border border-(--app-rand) bg-(--app-erhoben) p-1.5 shadow-xl",
            /*
             * ── Mobil: eine Fläche über dem Eingabefeld ───────────
             *
             * Am Chip verankert lief das Menü links aus dem Bild —
             * gemessen: linke Kante bei −61 Pixel, ein Fünftel der
             * Liste ausserhalb des Fensters. Die Breite zu begrenzen
             * half nicht, denn nicht sie war das Problem, sondern der
             * Ankerpunkt: Rechts vom Chip stehen noch Mikrofon und
             * Senden, also beginnt seine rechte Kante weit vor dem
             * Fensterrand.
             *
             * Auf schmalen Geräten hängt es deshalb nicht mehr am
             * Chip, sondern am Fenster.
             */
            "max-sm:fixed max-sm:inset-x-3 max-sm:bottom-[6.5rem] max-sm:w-auto",
          )}
        >
          {/*
            ── Die Denkintensität ────────────────────────────────
            
            Sie steht hier und nicht als eigener Knopf in der
            Bedienzeile — aus zwei Gründen.
            
            Sie ist eine Eigenschaft des gewählten Modells, nicht der
            Nachricht: Wechselt man das Modell, kann sie verschwinden.
            Ein Knopf, der je nach Nachbarauswahl da ist oder nicht,
            lässt die Zeile springen.
            
            Und: Die Liste hier weiss bereits, welches Modell sie
            kennt. Ein eigenes Bauteil müsste dieselbe Auskunft ein
            zweites Mal holen.
            
            Bei „Automatisch" erscheint sie nicht. Dann steht erst
            nach der Auswahl fest, wer antwortet — eine Intensität für
            ein unbekanntes Modell wäre eine Zusage, die niemand
            einhalten kann.
          */}
          {gewaehlt?.denktiefe && (
            <div className="mb-1.5 border-b border-(--app-rand) px-3 pt-1 pb-2.5">
              <p className="pb-1.5 text-2xs uppercase tracking-[0.08em] text-(--app-text-3)">
                Wie gründlich
              </p>
              <div className="flex gap-1">
                {(
                  [
                    ["niedrig", "Kurz"],
                    ["mittel", "Normal"],
                    ["hoch", "Gründlich"],
                  ] as const
                ).map(([wert, wort]) => (
                  <button
                    key={wert}
                    type="button"
                    onClick={() => setDenktiefe(denktiefe === wert ? null : wert)}
                    aria-pressed={denktiefe === wert}
                    className={cn(
                      "min-h-8 flex-1 rounded-(--radius-sm) px-2 text-xs transition-colors",
                      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--app-fokus)",
                      denktiefe === wert
                        ? "bg-(--app-gewaehlt) text-(--app-text)"
                        : "text-(--app-text-2) hover:bg-(--app-hover) hover:text-(--app-text)",
                    )}
                  >
                    {wort}
                  </button>
                ))}
              </div>
              <p className="pt-1.5 text-2xs leading-relaxed text-(--app-text-3)">
                Gründlicher heisst langsamer. Ohne Wahl entscheidet die Aufgabe.
              </p>
            </div>
          )}

          <Zeile
            name="Automatisch"
            beschreibung="Monday wählt passend zur Aufgabe."
            gewaehlt={modell === "auto"}
            empfohlen
            onWahl={() => {
              setModell("auto");
              setOffen(false);
            }}
          />

          {laedt && <p className="px-3 py-2 text-2xs text-(--app-text-3)">Wird geladen …</p>}

          {auskunft?.gruppen.map((g) => (
            <div key={g.anbieter} className="mt-1.5 border-t border-(--app-rand) pt-1.5">
              <p className="px-3 pb-1 text-2xs uppercase tracking-[0.08em] text-(--app-text-3)">
                {g.name}
              </p>
              {g.modelle.map((m) => (
                <Zeile
                  key={m.id}
                  name={m.name}
                  beschreibung={m.beschreibung}
                  vorschau={m.vorschau}
                  gewaehlt={modell === m.id}
                  onWahl={() => {
                    setModell(m.id);
                    setOffen(false);
                  }}
                />
              ))}
            </div>
          ))}

          {/*
            Der leere Fall bekommt einen Satz.
            Ohne ihn stünde dort „Automatisch" und darunter nichts, und
            niemand wüsste, ob die Funktion fehlt oder die Einrichtung.
          */}
          {auskunft && !auskunft.auswahlMoeglich && (
            <p className="mt-1.5 border-t border-(--app-rand) px-3 pt-2 text-2xs leading-relaxed text-(--app-text-3)">
              Es ist noch kein Modell freigegeben. Monday antwortet über die
              eingerichtete Verbindung.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Zeile({
  name,
  beschreibung,
  gewaehlt,
  empfohlen = false,
  vorschau = false,
  onWahl,
}: {
  name: string;
  beschreibung: string;
  gewaehlt: boolean;
  empfohlen?: boolean;
  vorschau?: boolean;
  onWahl: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={gewaehlt}
      onClick={onWahl}
      className="flex w-full items-start gap-2 rounded-(--radius-sm) px-3 py-2 text-left transition-colors hover:bg-soft"
    >
      <Check
        className={cn("mt-0.5 size-3.5 shrink-0", gewaehlt ? "text-accent" : "opacity-0")}
        strokeWidth={2.2}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-1.5">
          <span className="text-[13px] font-medium text-ink">{name}</span>
          {empfohlen && <span className="text-2xs text-ink-3">Empfohlen</span>}
          {vorschau && (
            <span className="rounded-(--radius-xs) border border-line px-1 text-2xs text-ink-3">
              Vorschau
            </span>
          )}
        </span>
        {beschreibung && (
          <span className="mt-0.5 block text-2xs leading-relaxed text-ink-3">
            {beschreibung}
          </span>
        )}
      </span>
    </button>
  );
}
