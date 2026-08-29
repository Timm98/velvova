"use client";

import { useEffect, useState } from "react";
import { ArrowDown, Check, Quote, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Die Produktvorschau im Hero.
 *
 * Kein Chat-Bildschirmfoto. Gezeigt wird der eine Vorgang, der das
 * Produkt vom Rest der Branche trennt: aus einem beiläufigen Satz wird
 * eine belegte Stärke, und daraus werden Berufswege, an die man selbst
 * nicht gedacht hätte.
 *
 * Die Sequenz läuft von allein, weil das die Kernidee in vier Sekunden
 * erzählt statt in einem Absatz. Wer weniger Bewegung eingestellt hat,
 * sieht alle drei Stufen sofort und vollständig — nichts geht verloren.
 */

const STEPS = [
  {
    kind: "said" as const,
    label: "Was du erzählst",
    text: "„Ich habe oft schwierige Kunden beruhigt.“",
  },
  {
    kind: "asked" as const,
    label: "Was Nina nachfragt",
    text: "„Erzähl mir von einer Eskalation, die du übernommen hast. Was hast du konkret getan — und was kam dabei heraus?“",
  },
  {
    kind: "evidence" as const,
    label: "Belegte Stärke",
    text: "Konfliktklärung · technische Vermittlung · Verantwortung unter Druck",
    roles: ["Implementation Specialist", "Customer Success", "Service Operations"],
  },
];

export function EvidenceSequence() {
  const [visible, setVisible] = useState(1);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVisible(STEPS.length);
      return;
    }

    const timers = [
      setTimeout(() => setVisible(2), 1400),
      setTimeout(() => setVisible(3), 2900),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="relative">
      {/* Ein sehr weiches Licht hinter der Karte. Es trägt keine
          Information — es hebt die Karte von der Fläche ab, so wie ein
          Objekt im Regal einen Schatten wirft. */}
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-[--radius-xl] bg-brand/[0.07] blur-3xl"
      />

      <div className="rounded-[--radius-xl] border border-line-2 bg-raised p-6 shadow-xl md:p-7">
        <div className="flex items-center gap-2.5 border-b border-line pb-4">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-[--radius-full] bg-assistant-soft"
          >
            <Sparkles className="size-3.5 text-assistant-text" strokeWidth={2} />
          </span>
          <span className="text-sm font-medium">Nina</span>
          <span className="ml-auto text-2xs uppercase tracking-wider text-ink-3">Beispiel</span>
        </div>

        <ol className="grid gap-3 pt-5">
          {STEPS.map((step, index) => (
            <li
              key={step.kind}
              aria-hidden={index >= visible}
              className={cn(
                "transition-all duration-[--duration-slow] ease-[--ease-out]",
                index < visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
              )}
            >
              {index > 0 && (
                <div aria-hidden className="flex justify-center py-1">
                  <ArrowDown className="size-3.5 text-ink-3" strokeWidth={1.8} />
                </div>
              )}

              <div
                className={cn(
                  "rounded-[--radius-lg] px-4 py-3.5",
                  step.kind === "said" && "bg-sunken",
                  step.kind === "asked" && "bg-assistant-soft",
                  step.kind === "evidence" && "border border-positive/25 bg-positive-soft",
                )}
              >
                <p className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wider text-ink-3">
                  {step.kind === "said" && <Quote className="size-3" strokeWidth={2} />}
                  {step.kind === "asked" && <Sparkles className="size-3" strokeWidth={2} />}
                  {step.kind === "evidence" && (
                    <Check className="size-3 text-positive" strokeWidth={2.4} />
                  )}
                  {step.label}
                </p>
                <p
                  className={cn(
                    "mt-1.5 text-sm leading-relaxed",
                    step.kind === "evidence" ? "font-medium text-ink" : "text-ink-2",
                  )}
                >
                  {step.text}
                </p>

                {step.roles && (
                  <div className="mt-3.5 border-t border-positive/20 pt-3">
                    <p className="text-2xs font-medium uppercase tracking-wider text-ink-3">
                      Passende Rollen
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {step.roles.map((role) => (
                        <li
                          key={role}
                          className="rounded-[--radius-full] border border-line-2 bg-raised px-2.5 py-1 text-xs"
                        >
                          {role}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
