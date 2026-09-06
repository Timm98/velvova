"use server";

import { getDb, schema, withUser } from "@paycheck/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";

/**
 * Eine gelesene Achse bestätigen oder ablehnen.
 *
 * ── Warum das Ablehnen nicht löscht ───────────────────────────
 *
 * Die Zeile bleibt stehen und trägt `bestaetigt = false`. Sie zählt
 * nicht mehr — aber sie ist noch da, mitsamt dem Beleg. Wer wissen
 * will, warum Nina etwas angenommen hat, kann es nachlesen; und wer
 * dieselbe Ableitung ein zweites Mal ablehnt, sieht, dass es nicht das
 * erste Mal war.
 *
 * Löschen hiesse: Der Widerspruch verschwindet zusammen mit dem, dem
 * widersprochen wurde.
 */
export async function achseBeurteilen(id: string, bestaetigt: boolean): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.arbeitsprofil)
      .set({ bestaetigt })
      .where(and(eq(schema.arbeitsprofil.id, id), eq(schema.arbeitsprofil.userId, user.id))),
  );
  revalidatePath("/app/career");
}
