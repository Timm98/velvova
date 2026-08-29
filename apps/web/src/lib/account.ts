"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";

/**
 * Den Anzeigenamen ändern.
 *
 * Bewusst eine eigene kleine Aktion statt eines Zweigs in
 * `updateSettings`: der Name steht in einer anderen Tabelle, und eine
 * Aktion, die je nach Formularinhalt in zwei Tabellen schreibt, wird
 * beim nächsten Feld unübersichtlich.
 */
export async function updateDisplayName(formData: FormData): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  const raw = String(formData.get("displayName") ?? "").trim();
  // Leer heißt: kein Name. Nicht der leere String — sonst steht später
  // "Hallo " ohne Namen dahinter.
  const displayName = raw.length > 0 ? raw.slice(0, 120) : null;

  await withUser(db, user.id, (tx) =>
    tx.update(schema.users).set({ displayName }).where(eq(schema.users.id, user.id)),
  );

  revalidatePath("/app", "layout");
}
