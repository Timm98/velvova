import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { listConversations } from "./conversations";

/**
 * ══════════════════════════════════════════════════════════════════
 * Die letzten Gespräche für die Seitenleiste
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Warum es diese Datei gibt und nicht nur `listConversations` ──
 *
 * Weil die Leiste etwas anderes braucht als eine Liste von Zeilen:
 * einen Text, den man lesen kann, und einen Weg, der irgendwohin
 * führt. `listConversations` liefert Datensätze; hier werden daraus
 * Einträge.
 *
 * ── Woher der Text kommt, wenn kein Titel gespeichert ist ───────
 *
 * Aus der ersten eigenen Nachricht. Das ist die einzige ehrliche
 * Quelle: Sie steht in der Datenbank, sie stammt von der Person, und
 * sie sagt tatsächlich, worum es ging.
 *
 * Nicht erfunden, nicht „Gespräch vom 9. September" — ein Datum als
 * Titel ist dasselbe wie kein Titel, nur länger. Und keine
 * Zusammenfassung durch ein Modell: Das kostet einen Aufruf je
 * Gespräch für eine Zeile in einer Leiste.
 *
 * ── Warum leere Gespräche nicht erscheinen ──────────────────────
 *
 * Jeder Aufruf von `/app/monday` legt eines an. Ohne diese Grenze
 * stünden dort zehn Einträge ohne Inhalt — eine Liste, die wächst,
 * wenn man nichts tut.
 */

export interface Leistengespraech {
  id: string;
  titel: string;
  href: string;
}

/** Länger als das passt nicht in die Leiste, ohne abgeschnitten zu wirken. */
const MAX_ZEICHEN = 42;

function kuerzen(text: string): string {
  const sauber = text.replace(/\s+/g, " ").trim();
  if (sauber.length <= MAX_ZEICHEN) return sauber;
  /* An der letzten Wortgrenze davor trennen: Ein Schnitt mitten im
     Wort liest sich wie ein Fehler, nicht wie eine Kürzung. */
  const schnitt = sauber.slice(0, MAX_ZEICHEN);
  const luecke = schnitt.lastIndexOf(" ");
  return `${luecke > MAX_ZEICHEN * 0.6 ? schnitt.slice(0, luecke) : schnitt}…`;
}

export async function gespraecheFuerLeiste(
  userId: string,
  anzahl = 8,
): Promise<Leistengespraech[]> {
  try {
    /* Mehr holen als angezeigt werden: Ein Teil fällt gleich wieder
       weg, weil noch nichts gesagt wurde. */
    const zeilen = (await listConversations(userId, anzahl * 3)).filter(
      (z) => (z.messageCount ?? 0) > 0,
    );
    if (zeilen.length === 0) return [];

    const ohneTitel = zeilen.filter((z) => !z.title?.trim()).map((z) => z.id);

    /*
     * Die ersten eigenen Nachrichten in EINER Abfrage.
     *
     * Je Gespräch eine eigene wären acht Netzrunden gegen Supabase
     * für eine Liste, die beim Laden jeder Seite entsteht.
     */
    const ersteNachrichten = new Map<string, string>();
    if (ohneTitel.length > 0) {
      const db = await getDb();
      const nachrichten = await withUser(db, userId, (tx) =>
        tx
          .select({
            conversationId: schema.ninaMessages.conversationId,
            content: schema.ninaMessages.content,
          })
          .from(schema.ninaMessages)
          .where(
            and(
              inArray(schema.ninaMessages.conversationId, ohneTitel),
              eq(schema.ninaMessages.role, "user"),
            ),
          )
          .orderBy(asc(schema.ninaMessages.createdAt)),
      );
      /* Die erste gewinnt — die Reihenfolge steht oben. */
      for (const n of nachrichten) {
        if (!ersteNachrichten.has(n.conversationId) && n.content.trim()) {
          ersteNachrichten.set(n.conversationId, n.content);
        }
      }
    }

    return zeilen
      .map((z) => {
        const roh = z.title?.trim() || ersteNachrichten.get(z.id);
        /* Ohne Text kein Eintrag. Ein Verweis, der „Gespräch" heisst,
           sagt nichts und wird trotzdem angeklickt. */
        return roh ? { id: z.id, titel: kuerzen(roh), href: `/app/monday?g=${z.id}` } : null;
      })
      .filter((e): e is Leistengespraech => e !== null)
      .slice(0, anzahl);
  } catch {
    /* Kein Abschnitt ist besser als keine Anwendung — dieselbe Regel
       wie bei den Projekten. */
    return [];
  }
}
