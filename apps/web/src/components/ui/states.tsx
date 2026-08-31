import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Badge } from "./badge.tsx";

/**
 * Zustände.
 *
 * Ein Produkt wird an seinen Randfällen beurteilt, nicht am Idealfall.
 * Leere Listen, fehlende Verbindungen und zu dünne Datenlagen brauchen
 * jeweils eine eigene, ehrliche Darstellung — und sie dürfen nicht wie
 * Fehler aussehen, wenn sie keine sind.
 *
 * Was hier NICHT mehr steht: `DemoNotice`, `DemoBadge`,
 * `LiveSourceNotice`. Die ersten beiden kennzeichneten erfundene
 * Inhalte — es gibt keine mehr, und ein Bauteil, das nur darauf wartet,
 * wieder benutzt zu werden, wird irgendwann wieder benutzt. Das dritte
 * war ihr Gegenstück und damit überflüssig: dass Stellen echt sind, ist
 * keine Auszeichnung, sondern die Voraussetzung. Die Herkunft steht
 * weiterhin an jeder Stelle — in `SourceNote`, wo sie hingehört.
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
    <div className="grid justify-items-center gap-4 rounded-(--radius-surface) bg-soft px-6 py-14 text-center">
      {icon && (
        <div className="grid size-12 place-items-center rounded-(--radius-full) bg-raised text-ink-3 shadow-sm">
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
    <div className="grid gap-3 rounded-(--radius-surface) bg-soft p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <Badge tone="outline">nicht verbunden</Badge>
        <span className="text-sm font-medium">{what}</span>
      </div>
      <p className="max-w-[var(--measure)] text-sm leading-relaxed text-ink-2">{detail}</p>
      {action}
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
      className="grid gap-3 rounded-(--radius-surface) bg-critical-soft p-5"
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
    <div className="grid gap-2 rounded-(--radius-lg) bg-soft p-4">
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
    /*
      `min-w-0` gehört an DIESES Element, nicht nur an die Spalte darin.
      
      Der Kopf ist selbst ein Raster-Kind der Seite. Ein Raster-Kind mit
      `min-width: auto` lässt seine Spur mitwachsen — die Spur wurde 351
      Pixel breit in einem 328 Pixel breiten Raster, und alle Geschwister
      wurden mitgezogen. Sichtbar war das als sieben Pixel Überlauf auf
      einem 360-Pixel-Gerät, verursacht von einer Überschrift, die zwei
      Abschnitte weiter oben steht.
    */
    <header className={cn("flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      {/*
        `min-w-0` — dieselbe Falle wie in der Jobliste, an einer neuen
        Stelle.

        Ein Flex-Kind hat `min-width: auto` und weigert sich, schmaler
        zu werden als sein Inhalt. Die Überschrift schob diese Spalte
        auf 351 Pixel in einem 328 Pixel breiten Elternteil — und damit
        die ganze Seite sieben Pixel nach rechts. `break-words` allein
        genügt nicht: es erlaubt den Umbruch, senkt aber die
        Mindestbreite nicht.
      */}
      <div className="grid min-w-0 gap-2">
        {eyebrow && (
          <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-3">{eyebrow}</p>
        )}
        {/*
          42px ab `sm`, darunter 36.

          Die Spanne 38–48 aus V7 §4.1 steht unter der Überschrift
          „Mindestgrößen Desktop" — sie gilt für den Desktop und wurde
          hier zunächst auf jede Breite angewandt. Auf einem 360-Pixel-
          Gerät passte „Möglichkeiten" dann nicht mehr in eine Zeile und
          schob die ganze Seite sieben Pixel nach rechts. Ein
          waagerechter Scrollbalken auf dem Telefon ist ein deutlicherer
          Mangel als eine um sechs Pixel kleinere Überschrift.

          `break-words` als zweiter Riegel: ein einzelnes langes Wort —
          und die deutsche Sprache hat viele — kann sonst jede
          Spaltenbreite sprengen, egal wie klein die Schrift ist.
        */}
        <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] break-words sm:text-4xl">
          {title}
        </h1>
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
          <h2 id={headingId} className="font-display text-lg font-semibold tracking-[-0.02em]">
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
