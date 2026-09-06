/**
 * Der Gehaltsrechner.
 *
 * Ein Einstiegspunkt, der die Länder-Rechner registriert und die
 * Auswahl übernimmt. Wer hier vorbeigeht und direkt einen Rechner
 * importiert, umgeht die Landprüfung — und genau die ist der Grund,
 * warum es diese Datei gibt.
 */
import "./de/2026/provider.ts";

export * from "./core/types.ts";
export * from "./core/dezimal.ts";
export { deutschland2026 } from "./de/2026/provider.ts";
