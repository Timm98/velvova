import { cn } from "@/lib/cn";

/**
 * Ladeplatzhalter mit wanderndem Lichtstreifen.
 *
 * Ein pulsierender grauer Block wirkt nach Baustelle; ein Streifen, der
 * einmal durchläuft, wirkt nach Arbeit im Hintergrund.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-[--radius-sm] bg-inset",
        "after:absolute after:inset-0 after:-translate-x-full",
        "after:bg-gradient-to-r after:from-transparent after:via-white/25 after:to-transparent",
        "after:animate-[shimmer_1.8s_infinite]",
        className,
      )}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("grid gap-2.5", className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">Wird geladen</span>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 && "w-3/5")} />
      ))}
    </div>
  );
}
