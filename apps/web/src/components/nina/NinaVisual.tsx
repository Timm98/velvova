"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { NinaVisualFallback } from "./NinaVisualFallback";
import { useNinaFallsVorhanden, type NinaVisualState } from "./NinaProvider";
import { cn } from "@/lib/cn";

/**
 * Monday, wie man sie sieht.
 *
 * Das 3D-Modell ist die eine Darstellung von Monday — nicht neben einem
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
  /*
   * `xs` für den Streifen unter der Kopfzeile.
   *
   * Dort standen zuerst 72 Pixel in einer 52 Pixel hohen Leiste — der
   * Core lief nach unten heraus und legte sich über die Zeile. Eine
   * eigene Stufe ist ehrlicher als den Streifen aufzublasen: Über dem
   * Inhalt liegen bereits Ankündigung, Kopfzeile und Wegeleiste, und
   * jeder weitere Streifen schiebt die Stellen tiefer.
   */
  xs: "h-[62px] w-[62px]",
  sm: "h-[86px] w-[86px]",
  md: "h-[144px] w-[144px]",
  lg: "h-[216px] w-[216px]",
  /* Für den Einstieg auf der Startseite: dort ist Monday der Grund, warum
     jemand die Seite geöffnet hat, und darf entsprechend gross sein. */
  /*
   * Relativ, nicht fest.
   *
   * `h-[640px] w-[640px]` schrumpfte nicht mit: Auf einem 320 Pixel
   * breiten Bildschirm stand der Core 340 Pixel über den Rand hinaus
   * und riss die ganze Seite auf. Eine feste Grösse in einem Gitter,
   * dessen Spalte schmaler ist, drückt — sie passt sich nicht an.
   */
  /*
   * An den Behälter gebunden, nicht an das Fenster.
   *
   * `min(88vw, 640px)` mass am Fenster — in einer 600 Pixel breiten
   * Spalte ergab das bei 1024 Pixeln Fensterbreite 640 Pixel und damit
   * 135 Pixel Überstand. Ein Element, das sich am Fenster orientiert,
   * weiss nichts von der Spalte, in der es steht.
   */
  xl: "aspect-square w-full max-w-[620px]",
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
  grund = "verlauf",
  zyklus = false,
}: {
  size?: keyof typeof GRÖSSE;
  /** Ohne Angabe kommt der Zustand aus dem Provider. */
  state?: NinaVisualState;
  className?: string;
  /**
   * Was hinter dem Modell liegt.
   *
   *   `verlauf`  ein weicher radialer Schein aus tiefem Indigo. Er
   *              gibt dem Leuchten etwas, wogegen es leuchtet — nötig
   *              überall dort, wo Monday auf heller Fläche steht.
   *
   *   `keiner`   nichts. Nur richtig, wenn der Aufrufer selbst für
   *              einen dunklen Grund sorgt; sonst ist das Modell auf
   *              weisser Seite praktisch unsichtbar.
   */
  grund?: "verlauf" | "keiner";
  /**
   * Die Zustände der Reihe nach durchlaufen.
   *
   * Nur für den Einstieg auf der Startseite gedacht. Dort steht Monday,
   * ohne dass ein Gespräch läuft — und ein Modell, das ruhig atmet,
   * zeigt nicht, was es kann. Der Durchlauf spielt CALM, Thinking und
   * Talking nacheinander, mit den Überblendungen, die das Modell
   * ohnehin mitbringt.
   *
   * Überall sonst bleibt der Zustand, was er ist: die Auskunft
   * darüber, was Monday gerade tut. Ihn dort zu erfinden hiesse, eine
   * Aussage über die Anwendung zu fälschen.
   */
  zyklus?: boolean;
  /**
   * Wann das Modell geholt wird.
   *
   *   `sichtbar`     sobald die Fläche ins Blickfeld kommt und der
   *                  Browser Luft hat. Für die Anwendung: dort ist Monday
   *                  der Grund, warum jemand die Seite geöffnet hat.
   *
   *   `beiInteresse` zusätzlich erst, wenn der Mensch bleibt — scrollt,
   *                  die Maus bewegt, etwas anfasst. Für die
   *                  Startseite: 9,7 MB sind viel für jemanden, der
   *                  nach zwei Sekunden wieder weg ist. Wer bleibt,
   *                  bekommt Monday; wer nur vorbeischaut, bekommt das
   *                  Signal und keine Rechnung.
   */
  strategie?: "sichtbar" | "beiInteresse";
}) {
  /*
   * Monday zeigt sich auch dort, wo kein Gespräch läuft.
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

  /*
   * Der Vorführdurchlauf.
   *
   * Wechselt alle sechs Sekunden zwischen den drei Clips, die die
   * Datei mitbringt. Sechs Sekunden, weil die Überblendung selbst
   * schon eine halbe braucht und ein Clip Zeit haben muss, seine
   * Bewegung zu zeigen — bei zwei Sekunden sähe man nur noch Übergänge.
   *
   * Bei „Bewegung reduzieren" bleibt es bei CALM: Wer Animationen
   * abbestellt hat, will keine Vorführung.
   */
  const [vorfuehrung, setVorfuehrung] = useState<NinaVisualState>("idle");
  useEffect(() => {
    if (!zyklus || ruhig) return;
    const folge: NinaVisualState[] = ["idle", "thinking", "speaking"];
    let i = 0;
    const uhr = setInterval(() => {
      i = (i + 1) % folge.length;
      setVorfuehrung(folge[i]!);
    }, 6000);
    return () => clearInterval(uhr);
  }, [zyklus, ruhig]);
  /* Einmal gescheitert, nicht wieder versuchen: der Loader hat es
     bereits mit derselben URL probiert, und ein zweiter Anlauf würde
     nur dieselben 12 MB erneut anfordern. */
  const [gescheitert, setGescheitert] = useState(false);

  const beiFehler = useCallback((fehler: unknown) => {
    // Der Grund gehört in die Konsole der Entwicklung, nicht auf den
    // Bildschirm der Person. Sie sieht Monday — nur flach.
    console.warn("Monday 3D nicht verfügbar:", fehler);
    setGescheitert(true);
  }, []);

  /*
   * Monday wird geladen, wenn sie zu sehen ist — nicht beim Seitenaufbau.
   *
   * Die Datei ist 9,7 MB über die Leitung. Auf der Startseite steht
   * Monday weit rechts im Blickfeld und ist für den ersten Eindruck
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
     * Ergebnis: Monday erschien auf der Startseite nie.
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
      className={cn("relative shrink-0 [&>canvas]:[filter:drop-shadow(0_0_1px_rgba(0,0,0,0.55))]", GRÖSSE[size], className)}
      /* Das Bild ist Dekoration. Die Bedeutung steht daneben im Text —
         ein Vorlesegerät soll keine Animation beschreiben. */
      aria-hidden
      /* Ein eigener Name: `data-nina-state` trägt auch das kleine
         Signal im Header, und eine Prüfung, die das erste Vorkommen
         nimmt, misst dann den falschen Zustand. */
      data-nina-visual={zustand}
    >
      {/*
       * Der Grund, auf dem Monday sichtbar wird.
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
      {/*
       * Nur unter dem Modell, nicht unter dem Ersatzbild.
       *
       * Diese Fläche ist fast deckendes Indigo. Unter der leuchtenden
       * 3D-Monday ist sie richtig: das Leuchten braucht etwas, wogegen es
       * leuchtet. Unter dem flachen Signal ist sie falsch — dort steht
       * dann eine dunkle Scheibe mit einem dünnen Drahtring darauf.
       *
       * Auf der Startseite war genau das der Dauerzustand. Das Modell
       * lädt dort mit `beiInteresse`, also erst nach einer Handlung;
       * bis dahin sah die erste Sekunde der Seite aus wie ein Bauteil,
       * das nicht fertig geladen hat. Ausgerechnet an der Stelle, an
       * der sich jemand ein Bild vom Produkt macht.
       */}
      {/*
        ══════════════════════════════════════════════════════════
        ENTFERNT: der lila Schein hinter Monday
        ══════════════════════════════════════════════════════════

        Hier lag ein radialer Verlauf aus `rgba(101, 93, 255, …)` —
        ein Indigo-Halo, der erschien, sobald das Modell geladen und
        im Blick war.

        Zweimal gemeldet: „der core dieser glow ist kacke, nur der
        core" und „oben beim core kommt manchmal lila". Das
        „manchmal" hatte einen Grund: Der Schein hing an `bereit &&
        imBlick` und blitzte deshalb genau im Moment des Ladens auf.

        Er ist weg. Monday steht auf dem Seitengrund, sonst nichts.
        Die Eigenschaft `grund` bleibt in der Schnittstelle, damit
        nichts an den Aufrufstellen bricht — sie schaltet nur nichts
        mehr ein.
      */}
      {/*
        Ein hauchdünner dunkler Saum um jedes sichtbare Pixel.

        `drop-shadow` folgt der Alphamaske des Canvas, nicht seinem
        Rechteck — es zeichnet also die Kontur jedes Rings, jeder
        Strebe und jedes Partikels nach, nicht einen Kasten. Ein Pixel
        Radius genügt: Auf hellem Grund setzen sich die feinen
        Strukturen dadurch ab, ohne dass es nach Umrandung aussieht.
      */}
      {bereit && imBlick && !gescheitert ? (
        <NinaScene state={zyklus ? vorfuehrung : zustand} reducedMotion={ruhig} onError={beiFehler} />
      ) : (
        <NinaVisualFallback state={zustand} size={size === "sm" ? "lg" : size === "md" ? "xl" : "hero"} />
      )}

      <span className="sr-only">Monday: {ZUSTAND_TEXT[zustand]}</span>
    </div>
  );
}
