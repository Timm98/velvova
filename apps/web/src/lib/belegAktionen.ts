"use server";

import { getDb, schema, withUser } from "@paycheck/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

/**
 * Einen Beleg zeigen oder nicht zeigen.
 *
 * Je Beleg, nicht je Profil. Ein Beleg kann etwas Unangenehmes sagen —
 * „hat Vertriebsaufgaben dreimal versucht, jedes Mal Energieverlust
 * berichtet". Für die Person selbst ist das die wertvollste Auskunft
 * im ganzen Profil; gegenüber einem Arbeitgeber ist es ihre
 * Entscheidung, nicht unsere.
 */
export async function belegTeilen(id: string, geteilt: boolean): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.evidenceItems)
      .set({ geteilt })
      .where(and(eq(schema.evidenceItems.id, id), eq(schema.evidenceItems.userId, user.id))),
  );
  revalidatePath("/app/belege");
}
