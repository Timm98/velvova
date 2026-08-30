import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/*
 * Eingabefelder.
 *
 * Kein sichtbarer Rahmen. Das Feld ist eine weiche Fläche mit eigenem
 * Ton — man erkennt es daran, dass es heller oder dunkler ist als sein
 * Grund, nicht daran, dass eine Linie es einrahmt.
 *
 * Der Fokus wird über Licht getragen: ein Ring aus der Akzentfarbe und
 * ein weicher Schein. Das ist deutlicher sichtbar als eine Kante, die
 * die Farbe wechselt, und es funktioniert auch für Menschen, die
 * Farbtöne schlecht unterscheiden — die Fläche verändert sich, nicht
 * nur ihr Rand.
 */
const fieldBase = [
  "w-full rounded-(--radius-input) bg-soft",
  "px-4 text-base text-ink placeholder:text-ink-3",
  "transition-[background-color,box-shadow] duration-(--duration-fast) ease-(--ease-out)",
  "hover:bg-soft-hover",
  "focus-visible:bg-raised focus-visible:outline-none",
  "focus-visible:shadow-[0_0_0_2px_var(--primary),0_6px_20px_rgba(98,92,255,0.16)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "aria-[invalid=true]:shadow-[0_0_0_2px_var(--danger)]",
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
      className={cn(fieldBase, "min-h-28 py-3.5 leading-relaxed resize-y", className)}
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
      <select className={cn(fieldBase, "h-11 appearance-none pr-11", className)} {...props}>
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
