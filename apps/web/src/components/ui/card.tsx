import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Karten.
 *
 * Die Fläche trägt die Trennung, nicht der Rahmen: ein sehr heller Rand
 * plus ein weicher Schatten. Eine kräftige Linie um jede Karte zerschneidet
 * die Seite und ist der häufigste Grund, warum Oberflächen unruhig wirken.
 *
 * `padded` ist die Voreinstellung, weil die meisten Karten schlicht Inhalt
 * halten. Wer eigene Abstände braucht, übergibt sie als Klasse — `twMerge`
 * lässt die spätere Klasse gewinnen, ein Widerspruch kann also nicht
 * entstehen.
 */
export function Card({
  className,
  interactive = false,
  padded = true,
  as: Tag = "div",
  ...props
}: HTMLAttributes<HTMLElement> & {
  interactive?: boolean;
  padded?: boolean;
  as?: "div" | "article" | "section" | "li";
}) {
  return (
    <Tag
      className={cn(
        "rounded-[--radius-lg] border border-line bg-raised shadow-sm",
        padded && "p-6",
        interactive && [
          "transition-[box-shadow,border-color,transform] duration-[--duration-base] ease-[--ease-out]",
          "hover:-translate-y-0.5 hover:border-line-2 hover:shadow-lg",
        ],
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
