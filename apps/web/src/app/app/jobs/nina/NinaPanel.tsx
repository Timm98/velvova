"use client";

import { JobWorkspace } from "./JobWorkspace";
import type { WorkspaceDaten } from "./daten";

/**
 * Abgelöst durch `JobWorkspace`.
 *
 * Hier stand ein eigenes Panel für eine dritte Spalte. Die dritte
 * Spalte hat sich nicht bewährt — bei 1200 Pixeln blieb für sie zu
 * wenig übrig —, und die Aufgabe ist inzwischen eine andere: Nicht
 * ein Panel NEBEN der Stellenanzeige, sondern die rechte Seite SELBST,
 * die zwischen Fakten und Deutung wechselt.
 *
 * Die Datei bleibt als Einstiegspunkt bestehen und reicht durch. Wer
 * `NinaPanel` importiert, bekommt den Arbeitsbereich — es gibt keine
 * zweite Fassung, die auseinanderlaufen könnte.
 */
export function NinaPanel({ daten }: { daten: WorkspaceDaten }) {
  return <JobWorkspace daten={daten} />;
}
