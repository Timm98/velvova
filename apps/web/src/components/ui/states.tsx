import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Badge } from "./badge.tsx";

/**
 * Zustände.
 *
 * Ein Produkt wird an seinen Randfällen beurteilt, nicht am Idealfall.
 * Leere Listen, fehlende Verbindungen, Demo-Daten und zu dünne
 * Datenlagen brauchen jeweils eine eigene, ehrliche Darstellung — und
 * sie dürfen nicht wie Fehler aussehen, wenn sie keine sind.
 */

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-4 rounded-[--radius-lg] border border-dashed border-line-2 bg-sunken/50 px-6 py-14 text-center">
      {icon && (
        <div className="grid size-11 place-items-center rounded-[--radius-full] bg-inset text-ink-3">
          {icon}
        </div>
      )}
      <div className="grid gap-2">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="mx-auto max-w-[46ch] text-sm leading-relaxed text-ink-2">{body}</p>
      </div>
      {action}
    </div>
  );
}

/**
 * Ein nicht eingerichteter Dienst.
 *
 * Der wichtigste Zustand im ganzen Produkt: Was nicht funktioniert, sagt
 * das. Es gibt keine Stelle, an der etwas funktionsfähig aussieht und es
 * nicht ist.
 */
export function NotConnected({
  what,
  detail,
  action,
}: {
  what: string;
  detail: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-[--radius-lg] border border-line bg-sunken/60 p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge tone="outline">nicht verbunden</Badge>
        <span className="text-sm font-medium">{what}</span>
      </div>
      <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">{detail}</p>
      {action}
    </div>
  );
}

/** Demo-Daten. Erscheint überall, wo synthetische Inhalte stehen. */
export function DemoNotice({ compact = false }: { compact?: boolean }) {
  if (compact) return <Badge tone="caution">Demo</Badge>;
  return (
    <div
      role="note"
      className="flex flex-wrap items-start gap-3 rounded-[--radius-md] border border-caution/30 bg-caution-soft px-4 py-3"
    >
      <Badge tone="caution">Demo-Daten</Badge>
      <p className="text-sm leading-relaxed text-ink-2">
        Diese Einträge sind erfunden. Keine echten Stellen, keine echten Unternehmen.
      </p>
    </div>
  );
}

/**
 * Der frühere Name derselben Kennzeichnung.
 *
 * Bleibt erhalten, damit Demo-Daten nirgends versehentlich ungekennzeichnet
 * bleiben, während die Seiten nach und nach umgestellt werden.
 */
export function DemoBadge({ inline = false }: { inline?: boolean }) {
  return <DemoNotice compact={inline} />;
}

/** Echte Daten aus einer externen Quelle. Das Gegenstück zur Demo-Kennzeichnung. */
export function LiveSourceNotice({ sourceName, count }: { sourceName: string; count: number }) {
  return (
    <div
      role="note"
      className="flex flex-wrap items-center gap-3 rounded-[--radius-md] border border-positive/25 bg-positive-soft px-4 py-3"
    >
      <Badge tone="positive">
        <span aria-hidden className="size-1.5 rounded-full bg-positive" />
        Echte Stellen
      </Badge>
      <p className="text-sm text-ink-2">
        {count} Stellen aus <span className="font-medium">{sourceName}</span>.
      </p>
    </div>
  );
}

export function ErrorState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="grid gap-3 rounded-[--radius-lg] border border-critical/30 bg-critical-soft p-5"
    >
      <h3 className="text-base font-semibold text-critical">{title}</h3>
      <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">{body}</p>
      {action}
    </div>
  );
}

/** Zu dünne Datenlage. Ausdrücklich kein schlechtes Ergebnis. */
export function InsufficientData({ what, why }: { what: string; why: string }) {
  return (
    <div className="grid gap-2 rounded-[--radius-md] bg-sunken p-4">
      <p className="text-sm font-medium">{what}</p>
      <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">{why}</p>
    </div>
  );
}

/** Quellenangabe. Steht an jeder externen Aussage. */
export function SourceNote({
  sourceName,
  sourceUrl,
  retrievedAt,
  kind,
  extra,
  openLabel = "Im Original öffnen",
}: {
  sourceName: string;
  sourceUrl?: string | null;
  retrievedAt: Date;
  kind: string;
  extra?: string | null;
  openLabel?: string;
}) {
  return (
    <p className="text-xs leading-relaxed text-ink-3">
      Quelle: {sourceName} · {kind} · abgerufen am{" "}
      {new Intl.DateTimeFormat("de-DE").format(retrievedAt)}
      {extra ? ` · ${extra}` : ""}
      {sourceUrl && (
        <>
          {" · "}
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-text underline underline-offset-[3px]"
          >
            {openLabel}
          </a>
        </>
      )}
    </p>
  );
}

/** Ein Seitenkopf mit optionalem Vorspann und Handlungen. */
export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="grid gap-2">
        {eyebrow && (
          <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-3">{eyebrow}</p>
        )}
        <h1 className="text-3xl font-semibold">{title}</h1>
        {lead && <p className="max-w-[var(--measure)] text-base text-ink-2">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </header>
  );
}

/** Ein Abschnitt mit Überschrift und optionaler Nebenhandlung. */
export function Section({
  title,
  description,
  action,
  children,
  id,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  const headingId = id ?? title.toLowerCase().replace(/\s+/g, "-");
  return (
    <section aria-labelledby={headingId} className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="grid gap-1">
          <h2 id={headingId} className="text-lg font-semibold">
            {title}
          </h2>
          {description && (
            <p className="max-w-[var(--measure)] text-sm text-ink-2">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
