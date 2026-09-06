"use server";

import { getDb, schema, withUser } from "@paycheck/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { recordEvent } from "./matching";
import { rueckmeldungSchreiben } from "./nina/rueckmeldung";
import { ABLEHNUNGSGRUENDE } from "./nina/musterregeln";

/** Aktionen an einer Stelle: merken, verwerfen, Bewerbung anlegen. */

export async function toggleSaveJob(jobId: string): Promise<{ saved: boolean }> {
  const user = await requireUser();
  const db = await getDb();

  const saved = await withUser(db, user.id, async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.savedJobs)
      .where(and(eq(schema.savedJobs.userId, user.id), eq(schema.savedJobs.jobId, jobId)))
      .limit(1);

    if (existing) {
      await tx.delete(schema.savedJobs).where(eq(schema.savedJobs.id, existing.id));
      return false;
    }
    await tx.insert(schema.savedJobs).values({ userId: user.id, jobId });
    return true;
  });

  if (saved) await recordEvent(user.id, "job_saved", { jobId });
  revalidatePath("/app/jobs");
  return { saved };
}

export async function viewJob(jobId: string): Promise<void> {
  const user = await requireUser();
  await recordEvent(user.id, "job_viewed", { jobId });
}

/**
 * Eine Bewerbung anlegen. Sie startet im Zustand "In Vorbereitung" -
 * angelegt heisst nicht versendet, und das bleibt an jeder Stelle so.
 */
export async function startApplication(jobId: string): Promise<string> {
  const user = await requireUser();
  const db = await getDb();

  const applicationId = await withUser(db, user.id, async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.applications)
      .where(and(eq(schema.applications.userId, user.id), eq(schema.applications.jobId, jobId)))
      .limit(1);

    if (existing) {
      if (existing.stage === "saved") {
        await tx
          .update(schema.applications)
          .set({ stage: "preparing", updatedAt: new Date() })
          .where(eq(schema.applications.id, existing.id));
      }
      return existing.id;
    }

    const [created] = await tx
      .insert(schema.applications)
      .values({ userId: user.id, jobId, stage: "preparing" })
      .returning();
    return created!.id;
  });

  await recordEvent(user.id, "application_started", { jobId, applicationId });
  revalidatePath("/app/applications");
  return applicationId;
}

export async function updateApplicationStage(
  applicationId: string,
  stage: (typeof schema.applications.$inferInsert)["stage"],
): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  await withUser(db, user.id, async (tx) => {
    await tx
      .update(schema.applications)
      .set({ stage, updatedAt: new Date(), lastContactAt: new Date() })
      .where(and(eq(schema.applications.id, applicationId), eq(schema.applications.userId, user.id)));
  });

  const eventByStage: Partial<Record<string, (typeof schema.applicationEvents.$inferInsert)["type"]>> = {
    sent: "application_sent",
    acknowledged: "acknowledged",
    interview: "interview_scheduled",
    offer: "offer_received",
    rejected: "rejected",
    withdrawn: "withdrawn",
    accepted: "accepted",
  };
  const eventType = stage ? eventByStage[stage] : undefined;
  if (eventType) await recordEvent(user.id, eventType, { applicationId });

  revalidatePath("/app/applications");
  revalidatePath(`/app/applications/${applicationId}`);
}

/**
 * Eine Stelle ablegen — mit Grund, wenn die Person einen nennt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Grund freiwillig ist
 * ══════════════════════════════════════════════════════════════
 *
 * Ein Pflichtfeld hier hiesse: Wer schnell durch eine Liste geht, muss
 * bei jeder Stelle eine Begründung anklicken. Das ist die zuverlässigste
 * Art, schlechte Daten zu bekommen — Leute klicken irgendetwas, und
 * Nina lernt daraus ein Muster, das es nie gab.
 *
 * Ohne Grund wird die Ablehnung trotzdem festgehalten. Sie zählt nur
 * nicht für die Mustererkennung, und das ist richtig so.
 *
 * ══════════════════════════════════════════════════════════════
 * Was mit einem erkannten Muster passiert
 * ══════════════════════════════════════════════════════════════
 *
 * Nichts Automatisches. Die Rückgabe enthält die Frage, die Nina
 * stellen soll — nicht eine Regel, die sie gesetzt hat. Aus sieben
 * Ablehnungen einen stillen Filter zu machen, hiesse Stellen
 * verschwinden zu lassen, ohne dass jemand das entschieden hat.
 */
export async function stelleAblehnen(
  jobId: string,
  grund?: string | null,
): Promise<{ frage: string | null }> {
  const user = await requireUser();

  /*
   * Nur bekannte Gründe.
   *
   * Der Wert kommt aus dem Browser und ist damit alles, was jemand
   * schicken will. Ein unbekannter Grund landete sonst in der Tabelle
   * und wäre für die Mustererkennung ein Schlüssel ohne Frage — ein
   * Muster, zu dem Nina nichts sagen kann.
   */
  const geprueft = grund && grund in ABLEHNUNGSGRUENDE ? grund : null;

  const { muster } = await rueckmeldungSchreiben(user.id, {
    jobId,
    art: "abgelehnt",
    grund: geprueft,
  });

  revalidatePath("/app/jobs");
  return { frage: muster?.frage ?? null };
}
