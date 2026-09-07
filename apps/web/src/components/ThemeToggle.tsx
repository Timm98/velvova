"use client";

import { ChevronDown, Monitor, Moon, Sun } from "lucide-react";
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
 * Und der vierte Fall, der keiner ist: nichts gewählt. Der ist
 * **System** — die Seite folgt dann dem Gerät.
 *
 * Hier stand einmal „hell", damit niemand ungefragt in einer dunklen
 * Oberfläche landet. Die Kehrseite wog schwerer: Ein Gerät auf Dunkel
 * zu stellen ist eine Aussage über Bildschirme, und sie zu übergehen
 * heisst nicht, niemanden festzulegen, sondern ihn auf Hell
 * festzulegen.
 *
 * „System“ setzt trotzdem weiter ein eigenes Attribut. Wer es
 * ausdrücklich wählt, soll von „nie gewählt“ unterscheidbar bleiben —
 * die Wahl gehört ihm, auch wenn sie gerade dasselbe bewirkt.
 */
export function ThemeToggle({
  labels,
  initial,
  dicht = false,
  feld = false,
}: {
  labels: { light: string; dark: string; system: string; group: string };
  initial?: Theme;
  /**
   * Dichte Fassung für den Fuss.
   *
   * Die 44 Pixel Höhe sind für die Einstellungsseite richtig — dort
   * ist die Umschaltung das Thema der Seite und wird mit dem Daumen
   * bedient. Im Fuss steht sie zwischen Kleingedrucktem und wirkt in
   * voller Grösse wie die wichtigste Angabe dort, was sie nicht ist.
   *
   * Deshalb ein Schalter statt einer kleineren Grundgrösse: Sonst
   * würde die Einstellungsseite den Zielbereich mit verlieren.
   */
  dicht?: boolean;
  /**
   * Als Auswahlfeld statt als Segmentschalter.
   *
   * Im Fuss steht die Darstellung neben „Einstellungen", und dort ist
   * ein Feld mit Zeichen und Pfeil die Form, die man erwartet. Drei
   * nebeneinanderliegende Flächen wären dort ein Fremdkörper.
   *
   * Ein echtes `<select>`, kein nachgebautes: Tastatur, Vorlesegerät
   * und die Auswahlliste des Betriebssystems kommen kostenlos mit,
   * und auf dem Telefon öffnet sich das gewohnte Rad.
   */
  feld?: boolean;
}) {
  const [theme, setTheme] = useState<Theme>(initial ?? "system");
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (initial) return;
    const el = document.documentElement;
    const gesetzt = el.dataset.theme;
    if (gesetzt === "light" || gesetzt === "dark") setTheme(gesetzt);
    else setTheme("system");
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

  if (feld) {
    const Zeichen = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
    return (
      <div className="relative w-full max-w-[22rem]">
        <Zeichen
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-2"
          strokeWidth={1.8}
        />
        <select
          aria-label={labels.group}
          value={theme}
          onChange={(e) => choose(e.target.value as Theme)}
          /* `appearance-none` und ein eigener Pfeil: Der Pfeil des
             Systems ist im hellen Blau des Fusses kaum zu sehen. */
          className="h-11 w-full appearance-none rounded-(--radius-control) border border-line bg-transparent pr-10 pl-9 text-sm text-ink"
        >
          <option value="light">{labels.light}</option>
          <option value="dark">{labels.dark}</option>
          <option value="system">{labels.system}</option>
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-2"
          strokeWidth={1.8}
        />
      </div>
    );
  }

  return (
    <fieldset
      className={cn(
        /* `max-w-full` und Umbruch: sonst steht die Gruppe in einer
           schmalen Fussspalte über den Rand hinaus. */
        "inline-flex max-w-full flex-wrap gap-1 rounded-(--radius-control) bg-soft",
        dicht ? "p-0.5" : "p-1",
      )}
    >
      <legend className="sr-only">{labels.group}</legend>
      {options.map(({ value, label, Icon }) => (
        <label
          key={value}
          className={cn(
            /* `px-3` statt `px-4` und `min-w-0`: Drei Wahlmöglichkeiten mit je
             16 Pixeln Innenabstand standen bei 320 Pixeln Fensterbreite
             sechs Pixel über den Rand. */
            "flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-(--radius-control) transition-colors duration-(--duration-fast)",
            dicht ? "min-h-8 px-2 text-xs" : "min-h-11 px-3 text-sm",
            "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
            /* Im Fuss trägt die gewählte Stufe keine Fettung mehr: Die
               erhöhte Fläche zeigt sie bereits, und zwei Signale für
               dieselbe Sache lassen den Schalter schwerer wirken als
               alles um ihn herum. */
            theme === value
              ? cn("bg-raised text-ink shadow-sm", !dicht && "font-medium")
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
          <Icon className={dicht ? "size-3.5" : "size-4"} strokeWidth={1.8} />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
