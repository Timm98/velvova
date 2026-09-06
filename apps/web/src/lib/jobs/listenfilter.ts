import { eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";

/**
 * Die Filter der Stellenliste — laden und behalten.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum eine geschlossene Liste erlaubter Schlüssel
 * ══════════════════════════════════════════════════════════════
 *
 * Weil hier alles landet, was in der Adresse steht — und dort steht
 * auch `job=…`, `anzahl=…`, `sort=…`. Das sind keine Filter, sondern
 * die Stelle, die gerade offen ist, und wie weit jemand gescrollt hat.
 *
 * Gespeichert und beim nächsten Besuch wiederhergestellt, hiesse das:
 * Man kommt auf die Seite, und es ist die Stelle von gestern
 * aufgeschlagen, in einer Liste von 150 Einträgen. Was gespeichert
 * wird, muss die Frage „wonach suche ich" beantworten — sonst nichts.
 */
export const FILTER_SCHLUESSEL = [
  "q",
  "nicht",
  "ort",
  "ortGenau",
  "umkreisKm",
  "pendelzeit",
  "remote",
  "contract",
  "arbeitszeit",
  "schicht",
  "gehaltAb",
  "salary",
  "since",
  /* Die Wahl „nur dieses Land" beziehungsweise „überall". */
  "land",
] as const;

export type Filterschluessel = (typeof FILTER_SCHLUESSEL)[number];

function istFilter(k: string): k is Filterschluessel {
  return (FILTER_SCHLUESSEL as readonly string[]).includes(k);
}

/** Nur die Filter aus einem Adressobjekt — der Rest bleibt draussen. */
export function nurFilter(params: Record<string, string | undefined>): Record<string, string> {
  const raus: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    if (istFilter(k)) raus[k] = v;
  }
  return raus;
}

/**
 * Den zuletzt benutzten Stand holen.
 *
 * `{}` heisst: noch nie etwas eingestellt. Das ist der Normalfall
 * beim ersten Besuch und kein Fehler.
 */
export async function filterLaden(userId: string): Promise<Record<string, string>> {
  try {
    const db = await getDb();
    const [zeile] = await withUser(db, userId, (tx) =>
      tx
        .select({ filter: schema.listenfilter.filter })
        .from(schema.listenfilter)
        .where(eq(schema.listenfilter.userId, userId))
        .limit(1),
    );
    return nurFilter(zeile?.filter ?? {});
  } catch {
    /*
     * Eine Stellenliste ohne gespeicherte Filter ist eine
     * Stellenliste. Eine, die wegen der Filtertabelle abstürzt, ist
     * keine.
     */
    return {};
  }
}

/**
 * Den Stand behalten.
 *
 * ── Warum ersetzt und nicht zusammengeführt ───────────────────
 *
 * Weil ein entfernter Filter sonst nie verschwände. Wer „egal wo"
 * sagt, nimmt den Ort weg; ein Zusammenführen mit dem gespeicherten
 * Stand brächte ihn beim nächsten Besuch zurück — und die Person
 * müsste ihn ein zweites Mal entfernen, ohne zu verstehen, warum.
 *
 * Der Aufrufer schickt den vollständigen Stand, nicht die Änderung.
 */
export async function filterMerken(
  userId: string,
  params: Record<string, string | undefined>,
): Promise<void> {
  const filter = nurFilter(params);
  try {
    const db = await getDb();
    await withUser(db, userId, (tx) =>
      tx
        .insert(schema.listenfilter)
        .values({ userId, filter, aktualisiertAm: new Date() })
        .onConflictDoUpdate({
          target: schema.listenfilter.userId,
          set: { filter, aktualisiertAm: new Date() },
        }),
    );
  } catch {
    /* Nicht gemerkt ist ärgerlich, nicht gefiltert wäre schlimmer. */
  }
}
