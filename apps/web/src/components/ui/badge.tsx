import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Etiketten.
 *
 * Sie tragen immer Text, nie nur Farbe — wer Farben nicht unterscheiden
 * kann, muss den Zustand trotzdem erkennen.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-(--radius-full) px-2.5 py-0.5 text-xs font-medium leading-5 whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "bg-soft text-ink-2",
        positive: "bg-positive-soft text-positive",
        caution: "bg-caution-soft text-caution",
        critical: "bg-critical-soft text-critical",
        assistant: "bg-assistant-soft text-assistant-text",
        accent: "bg-accent-soft text-accent-text",
        /* Die einzige Ausprägung, die noch eine Linie trägt — sie heißt
           schließlich so, und sie ist für den einen Fall, in dem etwas
           ausdrücklich leer und umrissen sein soll. */
        outline: "border border-line-2 bg-transparent text-ink-2",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
