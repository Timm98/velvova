import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Klassennamen zusammenführen.
 *
 * twMerge löst Konflikte zugunsten der späteren Klasse auf: "p-4 p-6"
 * wird zu "p-6". Ohne das würde jede Komponente, die Klassen von außen
 * annimmt, unvorhersehbar aussehen.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
