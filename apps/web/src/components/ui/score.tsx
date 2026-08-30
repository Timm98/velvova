import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Die Darstellung der Bewertungen.
 *
 * Hier wird die wichtigste Produktentscheidung sichtbar: Passung und
 * Sicherheit stehen NEBENEINANDER, nie ineinander. Eine 82 bei dünner
 * Datenlage ist eine andere Aussage als dieselbe Zahl bei guter — und
 * ein einzelner Prozentwert verschluckt genau diesen Unterschied.
 *
 * Wo die Datenlage nicht reicht, erscheint keine Zahl, sondern der Grund.
 */

/** Ein Ring statt eines Balkens: kompakter und ruhiger in einer Karte. */
export function ScoreRing({
  value,
  label,
  band,
  size = "md",
}: {
  value: number | null;
  label: string;
  band: string;
  size?: "sm" | "md" | "lg";
}) {
  const dimension = size === "lg" ? 76 : size === "sm" ? 44 : 60;
  const stroke = size === "lg" ? 5 : size === "sm" ? 3.5 : 4;
  const radius = (dimension - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = value === null ? 0 : (value / 100) * circumference;

  const tone =
    value === null
      ? "text-ink-3"
      : value >= 70
        ? "text-positive"
        : value >= 45
          ? "text-accent-text"
          : "text-ink-2";

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: dimension, height: dimension }}>
        <svg width={dimension} height={dimension} className="-rotate-90" aria-hidden>
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-inset"
          />
          {value !== null && (
            <circle
              cx={dimension / 2}
              cy={dimension / 2}
              r={radius}
              fill="none"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
              className={cn("transition-[stroke-dasharray] duration-(--duration-slow) ease-(--ease-out)", tone)}
              stroke="currentColor"
            />
          )}
        </svg>
        <span
          className={cn(
            "absolute inset-0 grid place-items-center font-semibold tabular",
            tone,
            size === "lg" ? "text-xl" : size === "sm" ? "text-xs" : "text-base",
          )}
        >
          {value ?? "–"}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-2xs font-medium uppercase tracking-wider text-ink-3">{label}</p>
        <p className="truncate text-sm text-ink-2">{band}</p>
      </div>
    </div>
  );
}

/**
 * Sicherheit als drei Stufen statt als Zahl.
 *
 * Sicherheit ist selbst keine präzise Größe — sie als "73 %" zu zeigen
 * wäre eine Genauigkeit, die es nicht gibt.
 */
export function ConfidenceMeter({
  level,
  label,
  reason,
}: {
  level: "high" | "medium" | "low";
  label: string;
  reason?: string;
}) {
  const filled = level === "high" ? 3 : level === "medium" ? 2 : 1;
  const tone =
    level === "high" ? "bg-positive" : level === "medium" ? "bg-caution" : "bg-critical";
  const text = level === "high" ? "hoch" : level === "medium" ? "mittel" : "niedrig";

  return (
    <div className="min-w-0">
      <p className="text-2xs font-medium uppercase tracking-wider text-ink-3">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <span aria-hidden className="flex gap-[3px]">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn("h-1.5 w-4 rounded-full", i < filled ? tone : "bg-inset")}
            />
          ))}
        </span>
        <span className="text-sm text-ink-2">{text}</span>
      </div>
      {reason && <p className="mt-1 text-xs leading-relaxed text-ink-3">{reason}</p>}
    </div>
  );
}

/** Ein Wert, der auch "nicht beurteilbar" sein darf. */
export function MetricValue({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "muted" | "positive" | "caution";
}) {
  return (
    <div className="min-w-0">
      <p className="text-2xs font-medium uppercase tracking-wider text-ink-3">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-sm",
          tone === "muted" && "text-ink-3",
          tone === "positive" && "text-positive",
          tone === "caution" && "text-caution",
          tone === "default" && "text-ink",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

/**
 * Die Aufschlüsselung eines Werts.
 *
 * Unbekannte Faktoren werden ausdrücklich als unbekannt gezeigt, nicht
 * weggelassen — sonst entsteht der Eindruck, sie seien geprüft und
 * schlecht ausgefallen.
 */
export function FactorList({
  factors,
  title,
  emptyNote,
}: {
  factors: { key: string; label: string; raw: number | null; weight: number; explanation: string }[];
  title: string;
  emptyNote: string;
}) {
  const known = factors.filter((f) => f.raw !== null);
  const unknown = factors.filter((f) => f.raw === null);

  return (
    <section className="grid gap-5">
      <h3 className="text-base font-semibold">{title}</h3>

      {known.length > 0 && (
        <ul className="grid gap-4">
          {known.map((f) => (
            <li key={f.key} className="grid gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">{f.label}</span>
                <span className="shrink-0 text-xs tabular text-ink-3">
                  {Math.round(f.weight * 100)} %
                </span>
              </div>
              <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-inset">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-(--duration-slow) ease-(--ease-out)"
                  style={{ width: `${Math.round((f.raw ?? 0) * 100)}%` }}
                />
              </div>
              <p className="text-sm leading-relaxed text-ink-2">{f.explanation}</p>
            </li>
          ))}
        </ul>
      )}

      {unknown.length > 0 && (
        <div className="grid gap-3 rounded-(--radius-md) bg-sunken p-4">
          <p className="text-sm leading-relaxed text-ink-2">{emptyNote}</p>
          <ul className="grid gap-2">
            {unknown.map((f) => (
              <li key={f.key} className="text-sm">
                <span className="font-medium text-ink-2">{f.label}</span>
                <span className="text-ink-3"> — {f.explanation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Ein Textblock mit Grund und Vorbehalt. Beide immer, nie nur einer. */
export function ReasonPair({
  reason,
  reservation,
  reasonLabel,
  reservationLabel,
}: {
  reason: string;
  reservation: string;
  reasonLabel: string;
  reservationLabel: string;
}) {
  return (
    <div className="grid gap-2.5 text-sm leading-relaxed">
      <p className="flex gap-2">
        <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-positive" />
        <span>
          <span className="font-medium text-positive">{reasonLabel}: </span>
          <span className="text-ink-2">{reason}</span>
        </span>
      </p>
      <p className="flex gap-2">
        <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-caution" />
        <span>
          <span className="font-medium text-caution">{reservationLabel}: </span>
          <span className="text-ink-2">{reservation}</span>
        </span>
      </p>
    </div>
  );
}

export function StatTile({
  label,
  value,
  children,
}: {
  label: string;
  value: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <span className="text-2xs font-medium uppercase tracking-wider text-ink-3">{label}</span>
      <span className="text-2xl font-semibold tabular leading-none">{value}</span>
      {children}
    </div>
  );
}
