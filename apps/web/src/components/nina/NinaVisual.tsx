"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { NinaSignal } from "./NinaSignal";
import { useNina, type NinaVisualState } from "./NinaProvider";
import { cn } from "@/lib/cn";

/**
 * Nina, wie man sie sieht.
 *
 * Das 3D-Modell ist die eine Darstellung von Nina — nicht neben einem
 * Kreis, einem Avatar oder einem KI-Symbol, sondern statt ihnen. Wo es
 * nicht laufen kann, tritt dasselbe Signal an seine Stelle, das die
 * Anwendung ohnehin kennt: dieselbe Formsprache, dieselben Zustände.
 *
 * Drei Gründe, warum es hier eine Hülle gibt und nicht direkt die Szene:
 *
 * 1. **Kein Server-Rendering.** Three.js braucht ein `window`. Ohne
 *    `ssr: false` bricht der Seitenaufbau ab, bevor irgendetwas zu
 *    sehen ist.
 *
 * 2. **Kein Ladebalken für 12 MB.** Das Modell kommt nach; bis dahin
 *    steht das Signal da. Eine leere Fläche mit Spinner wäre schlechter
 *    als ein einfacheres Bild.
 *
 * 3. **Ein Ausweg.** Ohne WebGL — ältere Geräte, abgeschaltete
 *    Hardwarebeschleunigung, Fernwartungssitzungen — gibt es kein
 *    kaputtes Canvas, sondern das Signal. Der technische Grund geht ins
 *    Protokoll, nicht auf den Bildschirm.
 */

const NinaScene = dynamic(() => import("./NinaScene").then((m) => m.NinaScene), {
  ssr: false,
  loading: () => null,
});

const GRÖSSE = {
  sm: "h-[72px] w-[72px]",
  md: "h-[120px] w-[120px]",
  lg: "h-[180px] w-[180px]",
} as const;

/** Fürs Vorlesegerät. Das Bild selbst ist Dekoration. */
const ZUSTAND_TEXT: Record<NinaVisualState, string> = {
  idle: "bereit",
  thinking: "denkt nach",
  talking: "spricht",
  listening: "hört zu",
  success: "bereit",
  error: "nicht erreichbar",
};

/**
 * Kann dieser Browser WebGL?
 *
 * Einmal geprüft und gemerkt: `getContext("webgl2")` erzeugt einen
 * echten Kontext, und das bei jedem Rendern zu tun wäre teurer als das,
 * was es prüft.
 */
let webglGeprüft: boolean | null = null;
function kannWebGL(): boolean {
  if (webglGeprüft !== null) return webglGeprüft;
  try {
    const canvas = document.createElement("canvas");
    webglGeprüft = Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
    );
  } catch {
    webglGeprüft = false;
  }
  return webglGeprüft;
}

export function NinaVisual({
  size = "md",
  state,
  className,
}: {
  size?: keyof typeof GRÖSSE;
  /** Ohne Angabe kommt der Zustand aus dem Provider. */
  state?: NinaVisualState;
  className?: string;
}) {
  const nina = useNina();
  const zustand = state ?? nina.visualState;

  const [bereit, setBereit] = useState(false);
  const [ruhig, setRuhig] = useState(false);

  useEffect(() => {
    // Erst im Browser entscheiden. Auf dem Server gibt es kein WebGL
    // und keine Bewegungseinstellung.
    setBereit(kannWebGL());
    const abfrage = window.matchMedia("(prefers-reduced-motion: reduce)");
    setRuhig(abfrage.matches);
    const beiWechsel = (e: MediaQueryListEvent) => setRuhig(e.matches);
    abfrage.addEventListener("change", beiWechsel);
    return () => abfrage.removeEventListener("change", beiWechsel);
  }, []);

  return (
    <div
      className={cn("relative shrink-0", GRÖSSE[size], className)}
      /* Das Bild ist Dekoration. Die Bedeutung steht daneben im Text —
         ein Vorlesegerät soll keine Animation beschreiben. */
      aria-hidden
      /* Ein eigener Name: `data-nina-state` trägt auch das kleine
         Signal im Header, und eine Prüfung, die das erste Vorkommen
         nimmt, misst dann den falschen Zustand. */
      data-nina-visual={zustand}
    >
      {/*
       * Der Grund, auf dem Nina sichtbar wird.
       *
       * Das Modell besteht aus elf rein weiß leuchtenden, transparenten
       * Materialien mit bis zu 25-facher Emissionsstärke — es ist für
       * dunklen Hintergrund gebaut. Auf der weißen Seite war es
       * schlicht unsichtbar.
       *
       * Kein Kasten und kein Rahmen: ein weicher radialer Verlauf von
       * tiefem Indigo nach transparent. Er liest sich als Lichtfläche,
       * gibt dem Leuchten aber etwas, wogegen es leuchten kann. Beim
       * Zuhören pulsiert er — das ersetzt den fehlenden
       * Listening-Clip, ohne eine Bewegung zu erfinden, die das Modell
       * nicht hat.
       */}
      <div
        className={cn(
          "pointer-events-none absolute inset-[-18%] rounded-full",
          zustand === "listening" && "motion-safe:animate-[pulse-soft_2.4s_ease-in-out_infinite]",
        )}
        style={{
          background:
            "radial-gradient(circle at 50% 45%, " +
            "rgba(28, 24, 74, 0.96) 0%, " +
            "rgba(46, 40, 110, 0.82) 38%, " +
            "rgba(101, 93, 255, 0.22) 66%, " +
            "rgba(101, 93, 255, 0) 78%)",
        }}
      />

      {bereit ? (
        <NinaScene state={zustand} reducedMotion={ruhig} />
      ) : (
        /* Der Ausweg: dasselbe Signal, dieselben Zustände. */
        <div className="grid h-full w-full place-items-center">
          <NinaSignal
            size={size === "sm" ? "lg" : "xl"}
            state={
              zustand === "thinking"
                ? "thinking"
                : zustand === "talking"
                  ? "speaking"
                  : zustand === "error"
                    ? "idle"
                    : "active"
            }
          />
        </div>
      )}

      <span className="sr-only">Nina: {ZUSTAND_TEXT[zustand]}</span>
    </div>
  );
}
