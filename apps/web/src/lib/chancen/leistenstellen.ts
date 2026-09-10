"use server";

import { requireUser } from "@/lib/auth";
import { projektStellen, type Projektstelle } from "./projekttreffer";

/**
 * Die Stellen eines Vorhabens für die Seitenleiste — beim Aufklappen.
 *
 * ── Warum nachgeladen und nicht mitgeliefert ────────────────────
 *
 * Die Leiste steht auf jeder Seite des Arbeitsbereichs. Zwölf
 * Vorhaben mit je ihren Stellen wären bei jedem Seitenaufruf zwölf
 * zusätzliche Abfragen — für Zeilen, die zugeklappt niemand sieht.
 *
 * Aufgeklappt ist eine Handlung. Erst dann kostet es etwas.
 *
 * ── Warum nur fünf ──────────────────────────────────────────────
 *
 * Die Leiste zeigt, WAS jemand vorhat, nicht alles darin. Vierzig
 * Stellen unter einem Vorhaben sind keine Übersicht mehr, sondern
 * eine Suche ohne Filter — und die gibt es auf der Stellenseite,
 * besser.
 */
const IN_DER_LEISTE = 5;

export async function leistenstellen(
  projektId: string,
): Promise<{ stellen: Projektstelle[]; gesamt: number }> {
  const user = await requireUser();
  try {
    /* Eine Abfrage, zwei Antworten: Es wird bis zur vollen Grenze
       gelesen, damit die Zahl unter der Liste stimmt — sonst stünde
       dort „5 von 5", solange es 30 sind. */
    const alle = await projektStellen(user.id, projektId);
    return { stellen: alle.slice(0, IN_DER_LEISTE), gesamt: alle.length };
  } catch (fehler) {
    /*
     * Kein Aufklappen ist besser als keine Leiste — aber nicht stumm.
     * Eine leere Liste sieht aus wie „keine Stellen gefunden", und das
     * ist eine Aussage über die Suche, nicht über einen Fehler.
     */
    console.error(
      "[projekte] Stellen für die Leiste konnten nicht geladen werden:",
      fehler instanceof Error ? fehler.message : String(fehler),
    );
    return { stellen: [], gesamt: -1 };
  }
}
