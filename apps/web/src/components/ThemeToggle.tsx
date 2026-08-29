"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

/**
 * Hell, Dunkel, System.
 *
 * Die Wahl landet in einem Cookie, damit der Server sie beim naechsten
 * Laden schon kennt und die Seite nicht kurz in der falschen Farbe
 * aufblitzt. "System" entfernt das Attribut - dann entscheiden die
 * Medienabfragen in den Tokens.
 */
export function ThemeToggle({
  labels,
}: {
  labels: { light: string; dark: string; system: string; group: string };
}) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const stored = document.documentElement.dataset.theme;
    setTheme(stored === "light" || stored === "dark" ? stored : "system");
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    if (next === "system") {
      delete document.documentElement.dataset.theme;
      document.cookie = "paycheck_theme=; Path=/; Max-Age=0; SameSite=Lax";
    } else {
      document.documentElement.dataset.theme = next;
      document.cookie = `paycheck_theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    }
  }

  const options: { value: Theme; label: string }[] = [
    { value: "light", label: labels.light },
    { value: "dark", label: labels.dark },
    { value: "system", label: labels.system },
  ];

  return (
    <fieldset
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-full)",
        padding: 2,
        display: "inline-flex",
        gap: 2,
        margin: 0,
      }}
    >
      <legend className="sr-only">{labels.group}</legend>
      {options.map((o) => (
        <label
          key={o.value}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-full)",
            fontSize: "var(--text-xs)",
            cursor: "pointer",
            minHeight: 36,
            background: theme === o.value ? "var(--surface-inset)" : "transparent",
            color: theme === o.value ? "var(--text-primary)" : "var(--text-secondary)",
            fontWeight: theme === o.value ? 500 : 400,
          }}
        >
          <input
            type="radio"
            name="theme"
            value={o.value}
            checked={theme === o.value}
            onChange={() => choose(o.value)}
            className="sr-only"
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Sprachumschalter. Ebenfalls per Cookie, damit die Wahl serverseitig
 * gilt und nicht erst nach dem ersten Rendern greift.
 */
export function LocaleToggle({ current }: { current: "de" | "en" }) {
  function choose(next: "de" | "en") {
    document.cookie = `paycheck_locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    window.location.reload();
  }

  return (
    <fieldset
      style={{
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-full)",
        padding: 2,
        display: "inline-flex",
        gap: 2,
        margin: 0,
      }}
    >
      <legend className="sr-only">Sprache / Language</legend>
      {(["de", "en"] as const).map((l) => (
        <label
          key={l}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "var(--space-2) var(--space-3)",
            borderRadius: "var(--radius-full)",
            fontSize: "var(--text-xs)",
            cursor: "pointer",
            minHeight: 36,
            background: current === l ? "var(--surface-inset)" : "transparent",
            color: current === l ? "var(--text-primary)" : "var(--text-secondary)",
            fontWeight: current === l ? 500 : 400,
            textTransform: "uppercase",
          }}
        >
          <input
            type="radio"
            name="locale"
            value={l}
            checked={current === l}
            onChange={() => choose(l)}
            className="sr-only"
          />
          {l}
        </label>
      ))}
    </fieldset>
  );
}
