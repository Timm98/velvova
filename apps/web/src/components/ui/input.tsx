import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const fieldBase = [
  "w-full rounded-[--radius-md] border border-line-2 bg-raised",
  "px-3.5 text-base text-ink placeholder:text-ink-3",
  "shadow-xs transition-[border-color,box-shadow] duration-[--duration-fast]",
  "hover:border-line-3",
  "focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent/30",
  "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-sunken",
  "aria-[invalid=true]:border-critical aria-[invalid=true]:outline-critical/25",
];

/**
 * Dieselben Klassen für Stellen, die noch ein rohes Feld rendern.
 * Ersetzt das frühere `inputStyle`-Objekt.
 */
export const inputClass = cn(fieldBase, "h-11");

export function Input({
  className,
  ref,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { ref?: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} className={cn(fieldBase, "h-11", className)} {...props} />;
}

/**
 * `ref` wird ausdrücklich durchgereicht: Eingabefelder brauchen den
 * Fokus von außen — nach dem Diktieren, nach einem Fehler, beim
 * Öffnen eines Formulars.
 */
export function Textarea({
  className,
  ref,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: React.Ref<HTMLTextAreaElement>;
}) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldBase, "min-h-28 py-3 leading-relaxed resize-y", className)}
      {...props}
    />
  );
}

/**
 * Ein natives <select> mit eigenem Pfeil.
 *
 * Bewusst nativ: auf dem Telefon öffnet es die Systemauswahl, die sich
 * mit einer Hand bedienen lässt. Ein nachgebautes Menü ist dort fast
 * immer schlechter.
 */
export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select className={cn(fieldBase, "h-11 appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 8 4 4 4-4" />
      </svg>
    </div>
  );
}
