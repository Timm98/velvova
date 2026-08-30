"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { saveTheme } from "@/lib/settings-actions";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark" | "system";

/**
 * Darstellung wählen.
 *
 * Die Wahl geht an zwei Orte, und beide sind nötig:
 *
 *   **Cookie** — damit der Server sie beim nächsten Laden schon im
 *   ersten Byte kennt. Ohne das blitzt die Seite kurz in der falschen
 *   Farbe auf, und zwar bei jedem einzelnen Aufruf.
 *
 *   **Datenbank** — damit sie einen Gerätewechsel überlebt. Ein Cookie
 *   gilt für einen Browser; die Einstellung gehört aber zur Person.
 *
 * Drei Werte, drei verschiedene Ergebnisse:
 *
 *   light    immer hell
 *   dark     immer dunkel
 *   system   folgt dem Gerät
 *
 * Und der vierte Fall, der keiner ist: nichts gewählt. Der ist **hell**,
 * nicht „System“. Wer sich neu anmeldet, soll nicht deshalb in einer
 * dunklen Oberfläche landen, weil sein Betriebssystem gerade dunkel
 * eingestellt ist. Deshalb setzt „System“ ein eigenes Attribut, statt
 * einfach alle Attribute zu entfernen — sonst wäre „System“ nicht von
 * „nie gewählt“ zu unterscheiden.
 */
export function ThemeToggle({
  labels,
  initial,
}: {
  labels: { light: string; dark: string; system: string; group: string };
  initial?: Theme;
}) {
  const [theme, setTheme] = useState<Theme>(initial ?? "light");
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (initial) return;
    const el = document.documentElement;
    const gesetzt = el.dataset.theme;
    if (gesetzt === "light" || gesetzt === "dark") setTheme(gesetzt);
    else if (el.dataset.themeMode === "system") setTheme("system");
    else setTheme("light");
  }, [initial]);

  function choose(next: Theme) {
    setTheme(next);

    const el = document.documentElement;
    if (next === "system") {
      delete el.dataset.theme;
      el.dataset.themeMode = "system";
    } else {
      delete el.dataset.themeMode;
      el.dataset.theme = next;
    }

    document.cookie = `paycheck_theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    startTransition(() => void saveTheme(next));
  }

  const options = [
    { value: "light" as const, label: labels.light, Icon: Sun },
    { value: "dark" as const, label: labels.dark, Icon: Moon },
    { value: "system" as const, label: labels.system, Icon: Monitor },
  ];

  return (
    <fieldset className="inline-flex gap-1 rounded-(--radius-control) bg-soft p-1">
      <legend className="sr-only">{labels.group}</legend>
      {options.map(({ value, label, Icon }) => (
        <label
          key={value}
          className={cn(
            "flex min-h-11 cursor-pointer items-center gap-2 rounded-(--radius-control) px-4 text-sm transition-colors duration-(--duration-fast)",
            "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
            theme === value
              ? "bg-raised font-medium text-ink shadow-sm"
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
