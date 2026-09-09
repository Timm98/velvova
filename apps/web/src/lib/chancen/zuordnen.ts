"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { requireUser } from "@/lib/auth";

/**
 * ══════════════════════════════════════════════════════════════════
 * Eine gemerkte Stelle einem Vorhaben zuordnen
 * ══════════════════════════════════════════════════════════════════
 *
 * `saved_jobs.projekt_id` gibt es seit der Migration, die Projektseite
 * liest die Spalte — und niemand hat sie je beschrieben. Der Abschnitt
 * „Stellen" eines Vorhabens war deshalb immer leer, unabhängig davon,
 * wie viele Stellen jemand gemerkt hatte.
 *
 * ── Warum von Hand und nicht automatisch ────────────────────────
 *
 * Weil eine automatische Zuordnung wissen müsste, welche Stelle zu
 * welchem Wunsch passt — und diese Bewertung je Vorhaben gibt es noch
 * nicht. Sie zu erfinden hiesse, eine Liste zu füllen, deren
 * Zusammensetzung niemand erklären kann.
 *
 * Von Hand ist wenig, aber es ist wahr: Was hier steht, hat ein
 * Mensch dorthin gelegt.
 */

/**
 * Die gemerkten Stellen, die noch zu keinem Vorhaben gehören.
 *
 * Nur die freien: Eine Stelle zweimal zuzuordnen ginge zwar — die
 * Spalte hält nur einen Wert —, aber die Liste wäre dann ein Angebot,
 * sie einem Vorhaben wegzunehmen, ohne dass das dort auffällt.
 */
export async function freieStellen(): Promise<
  { id: string; titel: string; firma: string }[]
> {
  const user = await requireUser();
  try {
    const db = await getDb();
    return await withUser(db, user.id, (tx) =>
      tx
        .select({
          id: schema.savedJobs.id,
          titel: schema.jobs.title,
          firma: schema.companies.name,
        })
        .from(schema.savedJobs)
        .innerJoin(schema.jobs, eq(schema.jobs.id, schema.savedJobs.jobId))
        .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
        .where(and(eq(schema.savedJobs.userId, user.id), isNull(schema.savedJobs.projektId)))
        .limit(30),
    );
  } catch {
    return [];
  }
}

export async function stelleZuordnen(savedJobId: string, projektId: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  /*
   * Beide Kennungen gegen den Nutzer prüfen, nicht nur eine.
   *
   * Die Bedingung nennt `userId` bei der Stelle UND das Vorhaben
   * gehört derselben Person. Ohne die zweite Prüfung liesse sich eine
   * eigene Stelle in ein fremdes Vorhaben legen — sichtbar würde das
   * dort und nicht hier.
   */
  const [projekt] = await withUser(db, user.id, (tx) =>
    tx
      .select({ id: schema.projekte.id })
      .from(schema.projekte)
      .where(and(eq(schema.projekte.id, projektId), eq(schema.projekte.userId, user.id)))
      .limit(1),
  );
  if (!projekt) return;

  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.savedJobs)
      .set({ projektId })
      .where(and(eq(schema.savedJobs.id, savedJobId), eq(schema.savedJobs.userId, user.id))),
  );

  revalidatePath(`/app/projekte/${projektId}`);
}

export async function stelleLoesen(savedJobId: string, projektId: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.savedJobs)
      /* `null`, nicht löschen: Die Stelle bleibt gemerkt, sie gehört
         nur zu keinem Vorhaben mehr. */
      .set({ projektId: null })
      .where(and(eq(schema.savedJobs.id, savedJobId), eq(schema.savedJobs.userId, user.id))),
  );
  revalidatePath(`/app/projekte/${projektId}`);
}
