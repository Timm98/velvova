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
  "inline-flex items-center gap-1.5 rounded-[--radius-full] border px-2.5 py-0.5 text-xs font-medium leading-5 whitespace-nowrap [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-line-2 bg-neutral-soft text-ink-2",
        positive: "border-positive/25 bg-positive-soft text-positive",
        caution: "border-caution/25 bg-caution-soft text-caution",
        critical: "border-critical/25 bg-critical-soft text-critical",
        assistant: "border-assistant-border bg-assistant-soft text-assistant-text",
        accent: "border-accent-border bg-accent-soft text-accent-text",
        outline: "border-line-2 bg-transparent text-ink-2",
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
