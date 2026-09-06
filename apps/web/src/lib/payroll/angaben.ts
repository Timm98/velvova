import type { Bundesland, Steuerklasse } from "./core/types.ts";

/**
 * Die Form der Steuerangaben und ihre Voreinstellung.
 *
 * Eigene Datei, weil `einstellungen.ts` mit `"use server"` beginnt und
 * dort nur asynchrone Funktionen stehen dürfen — ein exportiertes
 * Objekt daneben bricht den Build. Und zwar erst im Build: weder der
 * Typprüfer noch die Unit-Tests sehen es.
 *
 * Dass die Voreinstellung hier steht und nicht bei den Serveraktionen,
 * hat aber auch einen inhaltlichen Grund: sie wird im Browser genauso
 * gebraucht wie auf dem Server. Die Vorschau im Formular rechnet mit
 * ihr, bevor irgendetwas gespeichert ist.
 */

export interface Gehaltsangaben {
  steuerjahr: number;
  steuerklasse: Steuerklasse;
  bundesland: Bundesland;
  kirchensteuer: boolean;
  krankenversicherung: "gesetzlich" | "privat";
  krankenkasse: string | null;
  zusatzbeitrag: number;
  hatKinder: boolean;
  kinderzahl: number;
  zahlungen: 12 | 13 | 14;
  /** Ob diese Angaben dauerhaft hinterlegt sind. */
  gespeichert: boolean;
}

/**
 * Was gilt, solange niemand etwas eingestellt hat.
 *
 * Die häufigste Konstellation in Deutschland — und sie wird im Produkt
 * ausdrücklich als Annahme AUSGEWIESEN, nicht stillschweigend
 * unterstellt. Eine unsichtbare Voreinstellung wäre eine Behauptung
 * über die Lebenslage der Person.
 */
export const STANDARD: Gehaltsangaben = {
  steuerjahr: 2026,
  steuerklasse: 1,
  bundesland: "NW",
  kirchensteuer: false,
  krankenversicherung: "gesetzlich",
  krankenkasse: null,
  zusatzbeitrag: 0.0245,
  hatKinder: false,
  kinderzahl: 0,
  zahlungen: 12,
  gespeichert: false,
};
