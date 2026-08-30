import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Karten.
 *
 * Kein Rahmen mehr. Die Fläche trägt die Trennung allein: eine eigene
 * Helligkeit und ein weiter, fast farbloser Schatten. Eine Linie um jede
 * Karte zerschneidet die Seite und ist der häufigste Grund, warum
 * Oberflächen unruhig wirken.
 *
 * Zwei Ausprägungen, weil es zwei Aufgaben gibt:
 *
 *   `plain`  eine eigenständige Fläche über dem Seitengrund — weiß,
 *            leicht angehoben. Für Dinge, die für sich stehen.
 *   `soft`   eine Gruppenfläche — dieselbe Ebene, nur ein anderer Ton.
 *            Für „das gehört zusammen“, ohne dass etwas schwebt.
 *
 * `soft` ist die Antwort auf Karte-in-Karte: die innere Gruppe braucht
 * keine zweite Kante, sondern nur einen anderen Grund.
 */
export function Card({
  className,
  interactive = false,
  padded = true,
  tone = "plain",
  as: Tag = "div",
  ...props
}: HTMLAttributes<HTMLElement> & {
  interactive?: boolean;
  padded?: boolean;
  tone?: "plain" | "soft";
  as?: "div" | "article" | "section" | "li";
}) {
  return (
    <Tag
      className={cn(
        "rounded-(--radius-surface)",
        tone === "plain" ? "bg-raised shadow-sm" : "bg-soft",
        padded && "p-6",
        interactive && [
          "transition-[box-shadow,background-color,transform] duration-(--duration-base) ease-(--ease-out)",
          tone === "plain" ? "hover:-translate-y-0.5 hover:shadow-lg" : "hover:bg-soft-hover",
        ],
        className,
      )}
      {...props}
    />
  );
}

/**
 * Eine Zeile in einer weichen Gruppe.
 *
 * Statt „Kasten mit Beschriftung und Feld darin“: Beschriftung links,
 * Wert rechts, Trennung durch Abstand. Genau die Form aus der Vorgabe.
 */
export function Row({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4",
        className,
      )}
    >
      <div className="grid min-w-0 gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="text-xs leading-relaxed text-ink-3">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * Die Gruppenfläche selbst.
 *
 * Ein weicher Block, in dem Zeilen liegen. Die Trennung zwischen den
 * Zeilen ist eine sehr zarte Linie — nicht als Rahmen, sondern als
 * Lesehilfe in einer Liste, und nur zwischen den Zeilen, nie außen
 * herum.
 */
export function RowGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-(--radius-surface) bg-soft",
        "[&>*+*]:border-t [&>*+*]:border-line",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-6 pb-0", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-semibold", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-ink-2", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-3 p-6 pt-0", className)} {...props} />;
}
