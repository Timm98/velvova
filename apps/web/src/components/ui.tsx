import type { CSSProperties, ReactNode } from "react";

/**
 * Gemeinsame Bausteine. Bewusst wenige und schlicht gehalten - feine
 * Schatten statt harter Rahmen, großzügige Abstände, eine primäre
 * Handlung je Bildschirm.
 */

export function Card({
  children,
  as: Tag = "div",
  padded = true,
  style,
}: {
  children: ReactNode;
  as?: "div" | "article" | "section" | "li";
  padded?: boolean;
  style?: CSSProperties;
}) {
  return (
    <Tag
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        padding: padded ? "var(--space-5)" : 0,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

type ButtonTone = "primary" | "secondary" | "quiet" | "danger";

const TONE_STYLE: Record<ButtonTone, CSSProperties> = {
  primary: { background: "var(--accent)", color: "var(--accent-on)", border: "1px solid var(--accent)" },
  secondary: {
    background: "var(--surface-raised)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-default)",
  },
  quiet: { background: "transparent", color: "var(--text-secondary)", border: "1px solid transparent" },
  danger: {
    background: "var(--surface-raised)",
    color: "var(--critical)",
    border: "1px solid var(--critical)",
  },
};

export function buttonStyle(tone: ButtonTone = "secondary", full = false): CSSProperties {
  return {
    ...TONE_STYLE[tone],
    // Block-Element statt inline: bei inline-flex misst axe die Zeilen-
    // hoehe (rund 17px) statt der tatsaechlichen Hoehe (51px) und meldet
    // ein zu kleines Beruehrungsziel. width: fit-content haelt die
    // Darstellung unveraendert.
    display: "flex",
    width: full ? "100%" : "fit-content",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--space-2)",
    padding: "var(--space-3) var(--space-5)",
    // Mindesthoehe hier, nicht nur global: die CSS-Regel greift fuer
    // <button>, aber ein <a> mit Knopf-Aussehen bliebe flacher als die
    // von WCAG 2.2 geforderten 24 Pixel.
    minHeight: 44,
    borderRadius: "var(--radius-md)",
    fontSize: "var(--text-sm)",
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "none",
    transition: `background var(--duration-fast) var(--ease)`,
  };
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "caution" | "critical" | "assistant" | "accent";
}) {
  const map = {
    neutral: ["var(--neutral-subtle)", "var(--text-secondary)", "var(--border-default)"],
    positive: ["var(--positive-subtle)", "var(--positive)", "var(--positive)"],
    caution: ["var(--caution-subtle)", "var(--caution)", "var(--caution)"],
    critical: ["var(--critical-subtle)", "var(--critical)", "var(--critical)"],
    assistant: ["var(--assistant-subtle)", "var(--assistant-text)", "var(--assistant-border)"],
    accent: ["var(--accent-subtle)", "var(--accent-text)", "var(--accent-border)"],
  } as const;
  const [bg, fg, border] = map[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--space-1)",
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        borderRadius: "var(--radius-full)",
        padding: "2px var(--space-3)",
        fontSize: "var(--text-xs)",
        fontWeight: 500,
        lineHeight: 1.6,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

/**
 * Demo-Kennzeichnung. Erscheint überall, wo synthetische Daten stehen -
 * ein Demo-Datensatz darf nie wie ein echtes Angebot aussehen.
 */
export function DemoBadge({ inline = false }: { inline?: boolean }) {
  if (inline) return <Badge tone="caution">Demo</Badge>;
  return (
    <div
      role="note"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-3)",
        background: "var(--caution-subtle)",
        border: "1px solid var(--caution)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-3) var(--space-4)",
        fontSize: "var(--text-sm)",
      }}
    >
      <strong style={{ color: "var(--caution)", whiteSpace: "nowrap" }}>Demo-Modus</strong>
      <span style={{ color: "var(--text-secondary)" }}>
        Diese Daten sind erfunden. Es sind keine echten Stellen und keine echten Unternehmen.
      </span>
    </div>
  );
}

/** Ein Dienst, der nicht eingerichtet ist. Ehrlich statt kaputt. */
export function NotConnected({ what, detail }: { what: string; detail: string }) {
  return (
    <Card style={{ background: "var(--surface-sunken)", boxShadow: "none" }}>
      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Badge tone="neutral">nicht verbunden</Badge>
          <strong>{what}</strong>
        </span>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", maxWidth: "var(--measure)" }}>
          {detail}
        </p>
      </div>
    </Card>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card style={{ textAlign: "center", padding: "var(--space-8) var(--space-5)" }}>
      <div style={{ display: "grid", gap: "var(--space-3)", justifyItems: "center" }}>
        <h3 style={{ fontSize: "var(--text-lg)" }}>{title}</h3>
        <p style={{ color: "var(--text-secondary)", maxWidth: "48ch" }}>{body}</p>
        {action}
      </div>
    </Card>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div aria-busy="true" aria-live="polite" style={{ display: "grid", gap: "var(--space-3)" }}>
      <span className="sr-only">Wird geladen</span>
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          aria-hidden
          style={{
            height: 14,
            width: i === lines - 1 ? "60%" : "100%",
            background: "var(--surface-inset)",
            borderRadius: "var(--radius-sm)",
            animation: "pulse-soft 1.6s ease-in-out infinite",
          }}
        />
      ))}
    </div>
  );
}

/** Aufklappbarer Bereich. Details bleiben zugänglich, ohne zu erschlagen. */
export function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-raised)",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          padding: "var(--space-3) var(--space-4)",
          fontWeight: 500,
          fontSize: "var(--text-sm)",
          minHeight: 44,
          display: "flex",
          alignItems: "center",
        }}
      >
        {summary}
      </summary>
      <div style={{ padding: "0 var(--space-4) var(--space-4)" }}>{children}</div>
    </details>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;

  return (
    <div style={{ display: "grid", gap: "var(--space-2)" }}>
      <label htmlFor={htmlFor} style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>
        {label}
      </label>
      {children}
      {hint && (
        <p id={hintId} style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} style={{ fontSize: "var(--text-sm)", color: "var(--critical)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: 44,
  padding: "var(--space-3) var(--space-4)",
  background: "var(--surface-raised)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  fontSize: "var(--text-base)",
};

export function Stack({
  children,
  gap = 5,
  style,
}: {
  children: ReactNode;
  gap?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  style?: CSSProperties;
}) {
  return <div style={{ display: "grid", gap: `var(--space-${gap})`, ...style }}>{children}</div>;
}

export function PageHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <header style={{ display: "grid", gap: "var(--space-3)" }}>
      <h1 style={{ fontSize: "var(--text-2xl)", lineHeight: "var(--leading-2xl)" }}>{title}</h1>
      {lead && (
        <p style={{ color: "var(--text-secondary)", maxWidth: "var(--measure)", fontSize: "var(--text-lg)" }}>
          {lead}
        </p>
      )}
    </header>
  );
}

/** Quellenangabe. Steht an jeder externen Aussage. */
export function SourceNote({
  sourceName,
  sourceUrl,
  retrievedAt,
  kind,
  extra,
}: {
  sourceName: string;
  sourceUrl?: string | null;
  retrievedAt: Date;
  kind: string;
  extra?: string | null;
}) {
  return (
    <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.7 }}>
      Quelle: {sourceName} · Art: {kind} · abgerufen am{" "}
      {new Intl.DateTimeFormat("de-DE").format(retrievedAt)}
      {extra ? ` · ${extra}` : ""}
      {sourceUrl && (
        <>
          {" · "}
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-text)" }}>
            Im Original öffnen
          </a>
        </>
      )}
    </p>
  );
}
