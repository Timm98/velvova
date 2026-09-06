"use client";

import { useBestand } from "./BestandProvider";

/**
 * Die Bestandszahl, wie sie der Rahmen gerade führt.
 *
 * Rechnet nichts selbst: Der Zähler läuft einmal im `BestandProvider`,
 * und alle Stellen im Bild lesen denselben Wert. Zwei eigene
 * Zeitgeber, die dieselbe Formel rechnen, lasen `Date.now()` wenige
 * Millisekunden versetzt ab und zeigten abwechselnd Zahlen, die sich
 * um eins unterschieden.
 *
 * `start` bleibt als Rückfall: Ohne Rahmen — etwa in einem Test —
 * steht der serverseitige Stand da, statt gar nichts.
 */
export function LebendeZahl({
  start,
  className,
}: {
  start: number;
  className?: string;
}) {
  const bestand = useBestand();
  const wert = bestand?.wert ?? start;

  return (
    <span className={className} suppressHydrationWarning>
      {wert.toLocaleString("de-DE")}
    </span>
  );
}
