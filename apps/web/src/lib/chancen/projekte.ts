import { and, asc, eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";

/**
 * Die Vorhaben eines Menschen für die Seitenleiste.
 *
 * Nur die offenen. Ein abgeschlossenes Vorhaben ist nicht gelöscht —
 * es steht nur nicht mehr im Weg, und wer es sucht, findet es über
 * die Übersicht.
 *
 * ── Warum das den Fehler schluckt ───────────────────────────────
 *
 * Die Seitenleiste steht auf jeder Seite des Arbeitsbereichs. Wenn
 * die Tabelle noch nicht existiert — die Migration läuft nicht beim
 * Deploy —, darf das nicht die ganze Anwendung mitnehmen. Ohne
 * Projekte zeichnet die Leiste den Abschnitt einfach nicht.
 */
export async function projekteFuerLeiste(
  userId: string,
): Promise<{ id: string; titel: string; href: string }[]> {
  try {
    const db = await getDb();
    const zeilen = await withUser(db, userId, (tx) =>
      tx
        .select({ id: schema.projekte.id, name: schema.projekte.name })
        .from(schema.projekte)
        .where(
          and(
            eq(schema.projekte.userId, userId),
            eq(schema.projekte.status, "aktiv"),
          ),
        )
        .orderBy(asc(schema.projekte.ordnung), asc(schema.projekte.name)),
    );
    return zeilen.map((z) => ({
      id: z.id,
      titel: z.name,
      href: `/app/projekte/${z.id}`,
    }));
  } catch {
    /* Siehe oben: kein Abschnitt ist besser als keine Anwendung. */
    return [];
  }
}
