import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Schaltflächen.
 *
 * Drei Dinge, die den Unterschied zwischen billig und hochwertig
 * ausmachen:
 *
 * 1. Eine sichtbare Reaktion auf Druck (active:translate-y-px). Ohne sie
 *    fühlt sich eine Oberfläche tot an.
 * 2. Ein Innenschein auf der primären Fläche — ein Hauch Licht von oben,
 *    der die Fläche plastisch macht, ohne wie ein Verlauf auszusehen.
 * 3. Mindesthöhe auch für <a> mit Knopf-Aussehen: die globale CSS-Regel
 *    greift nur für <button>.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[--radius-md] font-medium",
    "transition-[background-color,color,box-shadow,transform] duration-[--duration-fast] ease-[--ease-out]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    "disabled:pointer-events-none disabled:opacity-45",
    "active:translate-y-px",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-accent text-accent-on shadow-sm",
          "hover:bg-accent-hover hover:shadow-md",
          "active:bg-accent-pressed",
          "inset-shadow-[0_1px_0_hsl(0_0%_100%/0.14)]",
        ],
        secondary: [
          "bg-raised text-ink border border-line-2 shadow-xs",
          "hover:bg-sunken hover:border-line-3",
        ],
        ghost: ["text-ink-2 hover:bg-sunken hover:text-ink"],
        subtle: ["bg-sunken text-ink hover:bg-inset"],
        danger: [
          "bg-raised text-critical border border-critical/40 shadow-xs",
          "hover:bg-critical-soft hover:border-critical",
        ],
        link: ["text-accent-text underline underline-offset-[3px] hover:text-accent-hover"],
      },
      size: {
        sm: "h-9 px-3.5 text-sm",
        md: "h-11 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
      full: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "secondary", size: "md", full: false },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Rendert als das übergebene Kindelement — für <Link> mit Knopf-Aussehen. */
  asChild?: boolean;
}

export function Button({ className, variant, size, full, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, full }), className)} {...props} />;
}

export { buttonVariants };
