import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/**
 * Schaltflächen.
 *
 * Alle rund. `rounded-control` ist 999 Pixel und kennt keine Ausnahme —
 * eine eckige Schaltfläche neben einer runden sieht nicht nach Absicht
 * aus, sondern nach vergessen.
 *
 * Die zweite und dritte Stufe tragen keinen Rahmen mehr, sondern eine
 * eigene Fläche. Das ist der Kern des Umbaus: Unterschied durch
 * Helligkeit statt durch Linie. Ein Rahmen um jede Schaltfläche macht
 * aus einer Werkzeugleiste ein Gitter.
 *
 * Drei Dinge, die den Unterschied zwischen billig und hochwertig
 * ausmachen:
 *
 * 1. Eine sichtbare Reaktion auf Druck (active:translate-y-px). Ohne sie
 *    fühlt sich eine Oberfläche tot an.
 * 2. Ein Innenschein auf der primären Fläche — ein Hauch Licht von oben,
 *    der die Fläche plastisch macht, ohne wie ein Verlauf auszusehen.
 * 3. Mindesthöhe auch für <a> mit Knopf-Aussehen: die globale CSS-Regel
 *    greift nur für <button>. 44 Pixel ab der mittleren Größe — das ist
 *    die kleinste Fläche, die ein Daumen zuverlässig trifft.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-(--radius-control) font-medium",
    "transition-[background-color,color,box-shadow,transform] duration-(--duration-fast) ease-(--ease-out)",
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
          "bg-raised text-ink shadow-sm",
          "hover:bg-soft hover:shadow-md",
        ],
        ghost: ["text-ink-2 hover:bg-soft hover:text-ink"],
        subtle: ["bg-soft text-ink hover:bg-soft-hover"],
        danger: [
          "bg-critical-soft text-critical",
          "hover:bg-critical-soft hover:shadow-sm",
        ],
        link: ["text-accent-text underline underline-offset-[3px] hover:text-accent-hover"],
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-sm",
        lg: "h-12 px-7 text-base",
        icon: "size-11",
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
