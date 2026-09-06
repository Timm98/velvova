"use server";

import { getDb, schema, withUser } from "@paycheck/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { recordEvent } from "@/lib/matching";

/**
 * Ein erhaltenes Angebot festhalten.
 *
 * ── Warum das fehlte ──────────────────────────────────────────
 *
 * Die Tabelle `offers` gibt es seit dem ersten Entwurf, und
 * `/app/offers` vergleicht Angebote in einer Tabelle. Angelegt hat
 * nie jemand eines — es gab kein Formular. Die Seite sagte „Sobald du
 * ein Angebot erhältst, kannst du es hier eintragen" und bot keinen
 * Weg dorthin.
 *
 * ── Warum nicht nur das Gehalt ────────────────────────────────
 *
 * Stunden, Remote-Anteil, Urlaub und Probezeit bestimmen den Alltag
 * oft stärker als die Zahl auf dem Papier — und sie sind in einer
 * Verhandlung meist beweglicher. Ein Formular, das nur nach dem Gehalt
 * fragt, lenkt das Gespräch auf die eine Grösse, die am festesten ist.
 */

export interface Angebotseingabe {
  applicationId: string;
  grundgehalt: number | null;
  bonus: number | null;
  wochenstunden: number | null;
  remoteAnteil: number | null;
  urlaubstage: number | null;
  probezeitMonate: number | null;
  entscheidungsfrist: string | null;
  notizen: string;
}

export async function angebotSpeichern(e: Angebotseingabe): Promise<void> {
  const user = await requireUser();
  const db = await getDb();

  /*
   * Prüfen statt vertrauen: Die Bewerbungskennung kommt aus dem
   * Formular. Ohne diese Abfrage könnte jemand ein Angebot an einer
   * fremden Bewerbung ablegen.
   */
  const [bewerbung] = await withUser(db, user.id, (tx) =>
    tx
      .select({ id: schema.applications.id, jobId: schema.applications.jobId })
      .from(schema.applications)
      .where(
        and(eq(schema.applications.id, e.applicationId), eq(schema.applications.userId, user.id)),
      )
      .limit(1),
  );
  if (!bewerbung) throw new Error("Diese Bewerbung gibt es nicht.");

  const zahl = (v: number | null, max: number) =>
    v === null || !Number.isFinite(v) ? null : Math.min(max, Math.max(0, Math.round(v)));

  await withUser(db, user.id, (tx) =>
    tx.insert(schema.offers).values({
      userId: user.id,
      applicationId: bewerbung.id,
      baseSalary: zahl(e.grundgehalt, 10_000_000),
      bonus: zahl(e.bonus, 10_000_000),
      vacationDays: zahl(e.urlaubstage, 365),
      weeklyHours: e.wochenstunden === null ? null : Math.min(80, Math.max(0, e.wochenstunden)),
      remotePercent: zahl(e.remoteAnteil, 100),
      probationMonths: zahl(e.probezeitMonate, 24),
      decisionDeadline: e.entscheidungsfrist ? new Date(e.entscheidungsfrist) : null,
      notes: e.notizen.slice(0, 4000),
    }),
  );

  /*
   * Das Angebot ist auch ein Ergebnis.
   *
   * `recordEvent` friert die Vorhersage ein und vermerkt das Datum —
   * ohne diesen Aufruf wüsste die Bilanz nie, welche Empfehlung zu
   * einem Angebot geführt hat.
   */
  await recordEvent(user.id, "offer_received", {
    applicationId: bewerbung.id,
    jobId: bewerbung.jobId,
  });

  revalidatePath("/app/offers");
  revalidatePath("/app/applications");
}
