"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark" | "system";

/**
 * Darstellung wählen.
 *
 * Die Wahl landet in einem Cookie, damit der Server sie beim nächsten
 * Laden schon kennt und die Seite nicht kurz in der falschen Farbe
 * aufblitzt. "System" entfernt das Attribut — dann entscheiden die
 * Medienabfragen in den Tokens.
 *
 * Steht ab jetzt in den Einstellungen, nicht mehr in der Kopfzeile.
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

  const options = [
    { value: "light" as const, label: labels.light, Icon: Sun },
    { value: "dark" as const, label: labels.dark, Icon: Moon },
    { value: "system" as const, label: labels.system, Icon: Monitor },
  ];

  return (
    <fieldset className="inline-flex gap-1 rounded-[--radius-md] border border-line-2 bg-sunken p-1">
      <legend className="sr-only">{labels.group}</legend>
      {options.map(({ value, label, Icon }) => (
        <label
          key={value}
          className={cn(
            "flex min-h-9 cursor-pointer items-center gap-2 rounded-[--radius-sm] px-3 text-sm transition-colors duration-[--duration-fast]",
            theme === value
              ? "bg-raised font-medium text-ink shadow-xs"
              : "text-ink-2 hover:text-ink",
          )}
        >
          <input
            type="radio"
            name="theme"
            value={value}
            checked={theme === value}
            onChange={() => choose(value)}
            className="sr-only"
          />
          <Icon className="size-4" strokeWidth={1.8} />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
