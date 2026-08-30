import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "./button.tsx";

/**
 * Kleine Bausteine für Seitenaufbau.
 *
 * `Stack` ersetzt die früheren Inline-Raster. Die Abstände kommen aus
 * einer festen Skala, damit vertikaler Rhythmus über alle Seiten hinweg
 * gleich bleibt — der wichtigste einzelne Grund, warum eine Oberfläche
 * ruhig statt zusammengewürfelt wirkt.
 */

const GAP: Record<number, string> = {
  1: "gap-1",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  5: "gap-6",
  6: "gap-8",
  7: "gap-10",
  8: "gap-14",
};

export function Stack({
  children,
  gap = 5,
  className,
  style,
}: {
  children: ReactNode;
  gap?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn("grid", GAP[gap], className)} style={style}>
      {children}
    </div>
  );
}

/** Ein Raster, das sich selbst umbricht. Für Kartenlisten. */
export function Grid({
  children,
  min = 300,
  className,
}: {
  children: ReactNode;
  min?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-4", className)}
      style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))` }}
    >
      {children}
    </div>
  );
}

/**
 * Aufklappbarer Bereich.
 *
 * Details bleiben erreichbar, ohne die Seite zu erschlagen. Der Pfeil
 * dreht sich beim Öffnen; das native `<details>` bleibt erhalten, damit
 * Tastatur und Vorlesesoftware ohne Zutun funktionieren.
 */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-(--radius-md) border border-line bg-raised shadow-xs [&[open]]:shadow-sm"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium transition-colors hover:bg-sunken rounded-(--radius-md) group-[[open]]:rounded-b-none">
        {summary}
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="size-4 shrink-0 text-ink-3 transition-transform duration-(--duration-fast) group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 8 4 4 4-4" />
        </svg>
      </summary>
      <div className="border-t border-line px-4 py-4">{children}</div>
    </details>
  );
}

/**
 * Knopf-Aussehen für Elemente, die keine Schaltfläche sind.
 *
 * Ersetzt das frühere `buttonStyle`, das ein Stilobjekt zurückgab. Eine
 * Klasse statt eines Objekts ist der Unterschied, der ein einheitliches
 * Designsystem überhaupt möglich macht: Zustände, Fokusringe und
 * Bewegungen lassen sich in einem Stilobjekt nicht ausdrücken.
 */
export function buttonClass(
  tone: "primary" | "secondary" | "quiet" | "danger" = "secondary",
  full = false,
  size: "sm" | "md" | "lg" = "md",
): string {
  const variant = tone === "quiet" ? "ghost" : tone;
  return buttonVariants({ variant, size, full });
}
