"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { MAX_NAME, MIN_NAME } from "@paycheck/domain";
import { requireUser } from "@/lib/auth";

/**
 * ══════════════════════════════════════════════════════════════════
 * Vorhaben von Hand anlegen, umbenennen, archivieren, löschen
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Warum es das neben der Zielerkennung gibt ───────────────────
 *
 * Weil die Erkennung ein Modell braucht und ein Modell ausfallen
 * kann. Ohne diesen Weg hinge die einzige Möglichkeit, einen
 * Arbeitsbereich anzulegen, an einem Anbieter — und wer gerade weiss,
 * was er vorhat, müsste es trotzdem erst jemandem erzählen.
 *
 * Ausserdem ist es der Weg, den `zuordnungPruefen` bei einer
 * Rückfrage offen lässt: „Soll das ein neues Vorhaben werden?" braucht
 * eine Antwort, die man auch geben kann.
 */

/* Kürzer ist kein Name, länger passt in keine Leiste — und beide
   Zahlen stehen in der Domäne, damit nicht jeder Weg zum Anlegen
   seine eigenen hat.

   Hier tippt ein Mensch, deshalb gilt die Domänenuntergrenze: „IT"
   ist ein Vorhaben. Die Zielerkennung ist an dieser Stelle strenger,
   weil dort ein Modell vorschlägt — die Begründung steht bei
   `PROJEKTGRENZEN`. */
const MIN = MIN_NAME;
const MAX = MAX_NAME;

function sauber(name: string): string | null {
  const n = name.replace(/\s+/g, " ").trim();
  return n.length >= MIN && n.length <= MAX ? n : null;
}

export async function projektAnlegen(name: string): Promise<{ id: string } | null> {
  const user = await requireUser();
  const n = sauber(name);
  if (!n) return null;

  try {
    const db = await getDb();
    const [angelegt] = await withUser(db, user.id, (tx) =>
      tx
        .insert(schema.projekte)
        .values({ userId: user.id, name: n, status: "aktiv" })
        .returning({ id: schema.projekte.id }),
    );
    revalidatePath("/app", "layout");
    return angelegt ?? null;
  } catch {
    return null;
  }
}

export async function projektUmbenennen(id: string, name: string): Promise<void> {
  const user = await requireUser();
  const n = sauber(name);
  if (!n) return;

  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.projekte)
      .set({ name: n })
      .where(and(eq(schema.projekte.id, id), eq(schema.projekte.userId, user.id))),
  );
  revalidatePath("/app", "layout");
}

/**
 * Archivieren statt löschen.
 *
 * Ein Vorhaben trägt Gespräche, zugeordnete Stellen und Bewerbungen.
 * „Ich brauche das gerade nicht" und „das soll weg" sind zwei
 * verschiedene Sätze, und nur einer davon ist unumkehrbar.
 */
export async function projektArchivieren(id: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.projekte)
      .set({ status: "archiviert" })
      .where(and(eq(schema.projekte.id, id), eq(schema.projekte.userId, user.id))),
  );
  revalidatePath("/app", "layout");
}

/**
 * Wirklich löschen.
 *
 * Die zugeordneten Stellen und Bewerbungen werden dabei NICHT
 * gelöscht — sie verlieren nur ihre Zuordnung. Das Vorhaben war eine
 * Klammer um Arbeit, nicht die Arbeit selbst; wer es wegwirft, will
 * die Klammer los und nicht seine Bewerbungen.
 *
 * Die Fremdschlüssel stehen auf `set null`, das erledigt die
 * Datenbank. Es steht hier trotzdem, weil man sich beim Lesen dieser
 * Funktion genau das fragt.
 */
export async function projektLoeschen(id: string): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  await withUser(db, user.id, (tx) =>
    tx
      .delete(schema.projekte)
      .where(and(eq(schema.projekte.id, id), eq(schema.projekte.userId, user.id))),
  );
  revalidatePath("/app", "layout");
}
