import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Ein Formularfeld mit Beschriftung, Hinweis und Fehler.
 *
 * Der Fehler steht am Feld UND wird per aria-describedby verknüpft. Eine
 * Fehlermeldung, die nur farbig ist oder nur oben in einer Sammelliste
 * steht, erreicht nicht jeden.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={htmlFor} className="flex items-baseline gap-2 text-sm font-medium text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-ink-3">optional</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-xs leading-relaxed text-ink-3">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="text-sm text-critical">
          {error}
        </p>
      )}
    </div>
  );
}
