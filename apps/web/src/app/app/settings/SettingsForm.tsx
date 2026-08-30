"use client";

import { useFormStatus } from "react-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Der Speichern-Knopf eines Einstellungsformulars.
 *
 * Er kennt seinen eigenen Zustand über useFormStatus, damit jedes
 * Formular seinen eigenen Ladezustand hat statt eines gemeinsamen für
 * die ganze Seite.
 */
export function SaveButton({ label = "Speichern" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? "Wird gespeichert …" : label}
    </Button>
  );
}

/** Ein Kontrollkästchen mit ausreichend großem Berührungsziel. */
export function Toggle({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-(--radius-md) py-1.5">
      {/* Das versteckte Feld sagt der Serveraktion: dieses Formular
          kannte den Schalter. Ohne es wäre "nicht gesendet" nicht von
          "nicht enthalten" zu unterscheiden. */}
      <input type="hidden" name={name} value="0" />
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-5 shrink-0 accent-accent"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-sm leading-relaxed text-ink-2">{hint}</span>}
      </span>
    </label>
  );
}

/** Eine Auswahl aus wenigen Möglichkeiten, als Karten statt als Liste. */
export function ChoiceGroup({
  name,
  legend,
  hint,
  options,
  defaultValue,
}: {
  name: string;
  legend: string;
  hint?: string;
  options: { value: string; label: string; description?: string }[];
  defaultValue?: string;
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium">{legend}</legend>
      {hint && <p className="-mt-1 text-sm text-ink-2">{hint}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-(--radius-md) border border-line-2 bg-raised px-4 py-3 transition-colors hover:border-line-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={defaultValue === option.value}
              className="mt-0.5 size-4 shrink-0 accent-accent"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{option.label}</span>
              {option.description && (
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-2">
                  {option.description}
                </span>
              )}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Mehrfachauswahl als Chips. */
export function ChipGroup({
  name,
  legend,
  options,
  selected,
}: {
  name: string;
  legend: string;
  options: { value: string; label: string }[];
  selected: string[];
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 rounded-(--radius-full) border border-line-2 bg-raised px-3.5 py-2 text-sm transition-colors hover:border-line-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-text"
          >
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={selected.includes(option.value)}
              className="sr-only peer"
            />
            <Check
              aria-hidden
              className="size-3.5 shrink-0 text-accent opacity-0 transition-opacity peer-checked:opacity-100"
              strokeWidth={2.4}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
