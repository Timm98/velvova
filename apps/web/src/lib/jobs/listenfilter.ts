import { eq } from "drizzle-orm";
import { getDb, schema, withUser, type Database } from "@paycheck/db";

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
/*
 * Die Schlüsselliste und `nurFilter` stehen in `filterschluessel.ts`.
 *
 * Dieselbe Trennung wie beim Zweig-Codec: Diese Datei greift auf die
 * Datenbank zu, der Suchcomposer im Browser braucht aber nur die
 * Liste. Ein Import von hier hätte Drizzle mit ins Client-Bündel
 * genommen.
 */
import { FILTER_SCHLUESSEL, nurFilter, type Filterschluessel } from "./filterschluessel.ts";

export { FILTER_SCHLUESSEL, nurFilter, type Filterschluessel };


/**
 * Den zuletzt benutzten Stand holen.
 *
 * `{}` heisst: noch nie etwas eingestellt. Das ist der Normalfall
 * beim ersten Besuch und kein Fehler.
 */
export async function filterLaden(userId: string): Promise<Record<string, string>> {
  try {
    const db = await getDb();
    return await withUser(db, userId, (tx) => filterAusTx(tx, userId));
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
 * Dieselben Filter, aber in einer bereits offenen Transaktion.
 *
 * Der Grund steht ausführlich in `gateAusTx`: Eine eigene
 * `withUser`-Transaktion kostet vier Netzrunden, drei davon
 * Verwaltung. Auf der Stellenseite laufen alle Lesevorgänge in einer.
 */
export async function filterAusTx(
  tx: Database,
  userId: string,
): Promise<Record<string, string>> {
  const [zeile] = await tx
    .select({ filter: schema.listenfilter.filter })
    .from(schema.listenfilter)
    .where(eq(schema.listenfilter.userId, userId))
    .limit(1);
  return nurFilter(zeile?.filter ?? {});
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
