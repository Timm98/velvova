import { cn } from "@/lib/cn";

/**
 * Nina Signal.
 *
 * Kein Chatbot-Symbol, kein Gesicht, keine Sprechblase. Nina ist eine
 * Analysefähigkeit, kein Gegenüber — und ein menschelndes Symbol würde
 * genau das versprechen, was das Produkt nicht einlöst.
 *
 * Stattdessen eine präzise Ringstruktur: ein feiner Außenring, ein
 * versetzter Bogen als Bewegungsspur, ein Kern. Der Zustand steckt
 * ausschließlich im Licht:
 *
 *   idle     ruhig, monochrom, unaufdringlich
 *   active   Kern leuchtet, Ring nimmt Signalfarbe an
 *   thinking der Bogen kreist langsam
 *   speaking der Kern atmet
 *
 * Alles ist SVG und CSS — kein Canvas, kein WebGL, kein Bild. Das hält
 * es scharf in jeder Größe und kostet nichts an Ladezeit.
 *
 * Für Vorlesesoftware gibt es die Textalternative: die Zustände sind
 * benannt, nicht nur gemalt.
 */

export type NinaState = "idle" | "active" | "thinking" | "speaking";

const STATE_LABEL: Record<NinaState, string> = {
  idle: "bereit",
  active: "aktiv",
  thinking: "denkt nach",
  speaking: "spricht",
};

const SIZES = {
  xs: 16,
  sm: 20,
  md: 28,
  lg: 44,
  xl: 72,
  /*
   * Die Grösse für den Auftritt, nicht für die Zeile.
   *
   * Auf der Startseite steht Nina in einer Fläche von 180 Pixeln. Mit
   * `xl` füllte sie davon 72 — ein kleiner Punkt in der Mitte einer
   * grossen leeren Box, umgeben vom dekorativen Schein des Abschnitts.
   * Das las sich nicht als „Nina", sondern als „hier lädt noch etwas".
   *
   * Der Fehler war nicht der Schein und nicht die Box, sondern das
   * Verhältnis: Ein Bauteil, das für einen Kopfzeilenpunkt gebaut ist,
   * trägt keinen Auftritt.
   */
  hero: 168,
} as const;

export function NinaSignal({
  state = "idle",
  size = "md",
  className,
  label,
}: {
  state?: NinaState;
  size?: keyof typeof SIZES;
  className?: string;
  /** Wenn gesetzt, wird das Signal für Vorlesesoftware benannt. Sonst
   *  gilt es als schmückend und wird übersprungen. */
  label?: string;
}) {
  const px = SIZES[size];
  const lit = state !== "idle";

  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: px, height: px }}
      role={label ? "img" : undefined}
      aria-label={label ? `${label} — ${STATE_LABEL[state]}` : undefined}
      aria-hidden={label ? undefined : true}
      data-nina-state={state}
    >
      {/* Der Lichthof. Nur im aktiven Zustand, und sehr weit. */}
      {lit && (
        <span
          className={cn(
            "absolute inset-[-45%] rounded-full opacity-60 blur-md",
            "signal-gradient",
            state === "speaking" && "motion-safe:animate-[nina-breathe_2.6s_ease-in-out_infinite]",
          )}
        />
      )}

      <svg
        viewBox="0 0 32 32"
        width={px}
        height={px}
        fill="none"
        className="relative"
        aria-hidden
      >
        <defs>
          <linearGradient id={`nina-arc-${state}`} x1="0" y1="0" x2="32" y2="32">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="50%" stopColor="var(--signal-violet)" />
            <stop offset="100%" stopColor="var(--signal-cyan)" />
          </linearGradient>
        </defs>

        {/* Außenring: immer da, trägt die Form. */}
        <circle
          cx="16"
          cy="16"
          r="13.2"
          stroke={lit ? "var(--border-strong)" : "var(--text-tertiary)"}
          strokeWidth="1.4"
          opacity={lit ? 0.85 : 0.5}
        />

        {/* Bogen: die Bewegungsspur. Kreist beim Nachdenken. */}
        <g
          className={cn(
            "origin-center",
            state === "thinking" &&
              "motion-safe:animate-[nina-orbit_2.2s_linear_infinite]",
          )}
        >
          <path
            d="M16 2.8 A13.2 13.2 0 0 1 29.2 16"
            stroke={lit ? `url(#nina-arc-${state})` : "var(--text-tertiary)"}
            strokeWidth="2"
            strokeLinecap="round"
            opacity={lit ? 1 : 0.35}
          />
        </g>

        {/* Kern: der Zustand in einem Punkt. */}
        <circle
          cx="16"
          cy="16"
          r={lit ? 4.6 : 3.4}
          fill={lit ? `url(#nina-arc-${state})` : "var(--text-tertiary)"}
          opacity={lit ? 1 : 0.55}
          className={cn(
            "transition-all duration-(--duration-slow) ease-(--ease-out)",
            state === "speaking" &&
              "motion-safe:animate-[nina-breathe_1.8s_ease-in-out_infinite]",
          )}
        />
      </svg>
    </span>
  );
}

/**
 * Die Marke: Signal plus Wortmarke.
 *
 * Das Signal ist das Logo. Ein separates Buchstabenquadrat daneben wäre
 * ein zweites Zeichen für dieselbe Sache.
 */
export function BrandMark({
  name,
  showName = true,
  state = "idle",
  size = "md",
  className,
}: {
  name: string;
  showName?: boolean;
  state?: NinaState;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <NinaSignal state={state} size={size} />
      {showName && (
        <span className="font-display text-[15px] font-semibold tracking-[-0.02em]">{name}</span>
      )}
    </span>
  );
}
