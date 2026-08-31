"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { NinaVisualFallback } from "./NinaVisualFallback";
import { useNinaFallsVorhanden, type NinaVisualState } from "./NinaProvider";
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
  speaking: "spricht",
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
  strategie = "sichtbar",
}: {
  size?: keyof typeof GRÖSSE;
  /** Ohne Angabe kommt der Zustand aus dem Provider. */
  state?: NinaVisualState;
  className?: string;
  /**
   * Wann das Modell geholt wird.
   *
   *   `sichtbar`     sobald die Fläche ins Blickfeld kommt und der
   *                  Browser Luft hat. Für die Anwendung: dort ist Nina
   *                  der Grund, warum jemand die Seite geöffnet hat.
   *
   *   `beiInteresse` zusätzlich erst, wenn der Mensch bleibt — scrollt,
   *                  die Maus bewegt, etwas anfasst. Für die
   *                  Startseite: 9,7 MB sind viel für jemanden, der
   *                  nach zwei Sekunden wieder weg ist. Wer bleibt,
   *                  bekommt Nina; wer nur vorbeischaut, bekommt das
   *                  Signal und keine Rechnung.
   */
  strategie?: "sichtbar" | "beiInteresse";
}) {
  /*
   * Nina zeigt sich auch dort, wo kein Gespräch läuft.
   *
   * Auf der Startseite gibt es keinen NinaProvider — es gibt ja nichts
   * zu besprechen. Mit `useNina()` hätte diese Komponente die Seite
   * beim Rendern zum Absturz gebracht; mit dem nachsichtigen Haken
   * genügt ein mitgegebener Zustand.
   */
  const nina = useNinaFallsVorhanden();
  const zustand = state ?? nina?.visualState ?? "idle";

  const behälter = useRef<HTMLDivElement>(null);
  const [bereit, setBereit] = useState(false);
  const [ruhig, setRuhig] = useState(false);
  /* Einmal gescheitert, nicht wieder versuchen: der Loader hat es
     bereits mit derselben URL probiert, und ein zweiter Anlauf würde
     nur dieselben 12 MB erneut anfordern. */
  const [gescheitert, setGescheitert] = useState(false);

  const beiFehler = useCallback((fehler: unknown) => {
    // Der Grund gehört in die Konsole der Entwicklung, nicht auf den
    // Bildschirm der Person. Sie sieht Nina — nur flach.
    console.warn("Nina 3D nicht verfügbar:", fehler);
    setGescheitert(true);
  }, []);

  /*
   * Nina wird geladen, wenn sie zu sehen ist — nicht beim Seitenaufbau.
   *
   * Die Datei ist 9,7 MB über die Leitung. Auf der Startseite steht
   * Nina weit rechts im Blickfeld und ist für den ersten Eindruck
   * unwichtig; sie trotzdem sofort zu holen hiess, jedem Besucher
   * 9,7 MB aufzuerlegen, bevor er einen Satz gelesen hat.
   *
   * Zwei Bedingungen, beide nötig:
   *
   *   **Im Blickfeld.** Ein IntersectionObserver wartet, bis die
   *   Fläche tatsächlich in die Nähe des Fensters kommt. `rootMargin`
   *   gibt 400 Pixel Vorlauf, damit sie beim Hinscrollen schon da ist.
   *
   *   **Browser hat Luft.** `requestIdleCallback` schiebt den Start
   *   hinter alles, was für die Bedienbarkeit zählt. Ohne das
   *   konkurriert der Download mit dem Javascript, das die Seite
   *   klickbar macht.
   *
   * Wer nicht wartet, sieht das Signal — dieselbe Formsprache, dieselben
   * Zustände. Es ist kein Platzhalter, sondern eine gültige Darstellung.
   */
  const [imBlick, setImBlick] = useState(false);
  useEffect(() => {
    const el = behälter.current;
    if (!el) return;

    /*
     * Bei gedrosselter Verbindung gar nicht.
     *
     * `saveData` setzt der Mensch selbst — es heisst „ich zahle für
     * jedes Megabyte" oder „ich habe kaum Empfang". Ein 3D-Modell
     * gegen diesen ausdrücklichen Wunsch zu laden wäre respektlos, und
     * das Signal sagt dasselbe aus.
     */
    const verbindung = (navigator as { connection?: { saveData?: boolean; effectiveType?: string } })
      .connection;
    if (verbindung?.saveData === true) return;
    if (verbindung?.effectiveType && /^(slow-)?2g$/.test(verbindung.effectiveType)) return;

    let idle = 0;
    let interesse = strategie === "sichtbar";
    let sichtbar = false;

    /*
     * Beide Bedingungen können in beliebiger Reihenfolge eintreten.
     *
     * Der erste Versuch prüfte nur im Beobachter — und der meldet sich
     * kein zweites Mal, solange das Element im Blickfeld BLEIBT. Wer
     * die Seite öffnete und danach die Maus bewegte, löste also nichts
     * aus: das Interesse kam an, aber niemand fragte mehr nach.
     * Ergebnis: Nina erschien auf der Startseite nie.
     */
    const vielleichtStarten = () => {
      if (!interesse || !sichtbar) return;
      beobachter.disconnect();
      const start = () => setImBlick(true);
      idle =
        typeof requestIdleCallback === "function"
          ? requestIdleCallback(start, { timeout: 2000 })
          : (setTimeout(start, 200) as unknown as number);
    };

    const aufwecken = () => {
      interesse = true;
      vielleichtStarten();
    };
    if (!interesse) {
      for (const art of ["scroll", "pointermove", "pointerdown", "keydown"]) {
        window.addEventListener(art, aufwecken, { once: true, passive: true });
      }
    }

    const beobachter = new IntersectionObserver(
      (einträge) => {
        if (!einträge.some((e) => e.isIntersecting)) return;
        sichtbar = true;
        vielleichtStarten();
      },
      { rootMargin: "400px" },
    );
    beobachter.observe(el);

    return () => {
      beobachter.disconnect();
      for (const art of ["scroll", "pointermove", "pointerdown", "keydown"]) {
        window.removeEventListener(art, aufwecken);
      }
      if (typeof cancelIdleCallback === "function") cancelIdleCallback(idle);
    };
  }, [strategie]);

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
      ref={behälter}
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

      {bereit && imBlick && !gescheitert ? (
        <NinaScene state={zustand} reducedMotion={ruhig} onError={beiFehler} />
      ) : (
        <NinaVisualFallback state={zustand} size={size === "sm" ? "lg" : "xl"} />
      )}

      <span className="sr-only">Nina: {ZUSTAND_TEXT[zustand]}</span>
    </div>
  );
}
