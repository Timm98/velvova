import { getDb, schema } from "@paycheck/db";
import { and, isNotNull, lt, sql } from "drizzle-orm";

/**
 * Aufbewahrung durchsetzen.
 *
 * Der Teil einer Loeschzusage, der tatsaechlich loescht. Soft Delete
 * allein waere eine Behauptung; hier wird sie eingeloest - nach einer
 * Frist, die dem Menschen genannt wird.
 */

const HARD_DELETE_AFTER_DAYS = 30;

export interface RetentionResult {
  belegeEntfernt: number;
  dokumenteEntfernt: number;
  kontenEntfernt: number;
  abgelaufeneSitzungen: number;
}

export async function runRetention(now = new Date()): Promise<RetentionResult> {
  const db = await getDb();
  const cutoff = new Date(now.getTime() - HARD_DELETE_AFTER_DAYS * 86_400_000);

  // Belege, die vor der Frist als geloescht markiert wurden.
  const belege = await db
    .delete(schema.evidenceItems)
    .where(and(isNotNull(schema.evidenceItems.deletedAt), lt(schema.evidenceItems.deletedAt, cutoff)))
    .returning({ id: schema.evidenceItems.id });

  const dokumente = await db
    .delete(schema.documents)
    .where(and(isNotNull(schema.documents.deletedAt), lt(schema.documents.deletedAt, cutoff)))
    .returning({ id: schema.documents.id });

  // Abgelaufene Sitzungen aufraeumen - sie sind ohnehin wertlos.
  const sitzungen = await db
    .delete(schema.sessions)
    .where(lt(schema.sessions.expiresAt, now))
    .returning({ id: schema.sessions.id });

  // Konten zuletzt: die Fremdschluessel raeumen den Rest per Kaskade ab.
  const konten = await db
    .delete(schema.users)
    .where(and(isNotNull(schema.users.deletedAt), lt(schema.users.deletedAt, cutoff)))
    .returning({ id: schema.users.id });

  // Sitzungsgebundene Inhalte, die ihre Klasse ueberschritten haben.
  await db.execute(sql`
    DELETE FROM evidence_items
    WHERE retention_class = 'session_only'
      AND created_at < ${new Date(now.getTime() - 86_400_000)}
  `);

  return {
    belegeEntfernt: belege.length,
    dokumenteEntfernt: dokumente.length,
    kontenEntfernt: konten.length,
    abgelaufeneSitzungen: sitzungen.length,
  };
}
