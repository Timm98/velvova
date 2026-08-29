import { cn } from "@/lib/cn";

/** Eine Trennlinie, die an den Rändern ausläuft — ruhiger als eine Kante. */
export function Separator({
  className,
  soft = false,
}: {
  className?: string;
  soft?: boolean;
}) {
  return (
    <div
      role="separator"
      className={cn(soft ? "rule-fade" : "h-px w-full bg-line", className)}
    />
  );
}
