"use server";

import { getDb, schema, withUser } from "@paycheck/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { recordEvent } from "@/lib/matching";
import { zufriedenheitVermerken } from "@/lib/ergebnisse";
import { checkInAbgehakt } from "@/lib/erinnerungen";
import { angabeErfassen } from "@/lib/arbeitsprofil";
import { stellenDimensionen } from "@paycheck/matching";
import { rowToJob } from "@/lib/matching";

/**
 * Der Jobstart-Loop — als Funktion, nicht als Beschreibung.
 *
 * ── Was hier vorher stand ─────────────────────────────────────
 *
 * Nichts. Die Seite `/app/check-ins` listete vorhandene Check-ins und
 * erklärte, worauf sie schauen — aber es gab kein Formular, und
 * `check_ins` wurde von nirgendwo geschrieben. Der wichtigste
 * Rückkanal des Produkts existierte als Text über sich selbst.
 *
 * ── Warum die Antworten privat bleiben ────────────────────────
 *
 * `sharedWithPartner` steht auf false und wird hier nie gesetzt. Was
 * jemand über seinen neuen Arbeitgeber schreibt, ist das Empfindlichste
 * im ganzen Produkt. Für die Auswertung verlässt nur die Zahl zwischen
 * 1 und 5 diese Zeile — und auch die erst als Mittelwert über
 * mindestens zwanzig Fälle.
 */

export interface CheckInEingabe {
  applicationId: string;
  tagesmarke: number;
  /** 1 bis 5. Der einzige Wert, der je in eine Auswertung eingeht. */
  gesamtpassung: number;
  versprechenGegenWirklichkeit?: string;
  aufgabenEnergie?: string;
  fuehrungUndTeam?: string;
  lernmoeglichkeiten?: string;
}

const MARKEN = [30, 60, 90, 180];

export async function checkInSpeichern(eingabe: CheckInEingabe): Promise<void> {
  const user = await requireUser();

  /*
   * Prüfen statt vertrauen.
   *
   * Die Bewerbungskennung kommt aus dem Formular. Ohne diese Abfrage
   * könnte jemand eine fremde Kennung senden und einen Check-in an
   * einer Bewerbung ablegen, die ihm nicht gehört.
   */
  const db = await getDb();
  const [bewerbung] = await withUser(db, user.id, (tx) =>
    tx
      .select({ id: schema.applications.id, jobId: schema.applications.jobId })
      .from(schema.applications)
      .where(
        and(
          eq(schema.applications.id, eingabe.applicationId),
          eq(schema.applications.userId, user.id),
        ),
      )
      .limit(1),
  );
  if (!bewerbung) throw new Error("Diese Bewerbung gibt es nicht.");

  const marke = MARKEN.includes(eingabe.tagesmarke) ? eingabe.tagesmarke : 30;
  const wert = Math.min(5, Math.max(1, Math.round(eingabe.gesamtpassung)));

  await withUser(db, user.id, (tx) =>
    tx.insert(schema.checkIns).values({
      userId: user.id,
      applicationId: bewerbung.id,
      dayMark: marke,
      overallFit: wert,
      promiseVsReality: eingabe.versprechenGegenWirklichkeit || null,
      taskEnergy: eingabe.aufgabenEnergie || null,
      leadershipAndTeam: eingabe.fuehrungUndTeam || null,
      learningOpportunities: eingabe.lernmoeglichkeiten || null,
      sharedWithPartner: false,
    }),
  );

  /*
   * Erst danach in den Outcome Loop.
   *
   * Scheitert die Auswertungsspur, ist der Check-in trotzdem
   * gespeichert — er gehört dem Menschen, die Auswertung ist unser
   * Anliegen.
   */
  await zufriedenheitVermerken(user.id, bewerbung.jobId, marke, wert);
  await recordEvent(
    user.id,
    marke >= 180 ? "fit_check_180" : marke >= 90 ? "fit_check_90" : marke >= 60 ? "fit_check_60" : "fit_check_30",
    { applicationId: bewerbung.id, jobId: bewerbung.jobId },
  );

  await checkInAbgehakt(user.id, bewerbung.id, marke);
  await twinAusCheckIn(user.id, bewerbung.jobId, marke, wert);

  revalidatePath("/app/check-ins");
}

/**
 * Was ein Check-in über den Menschen verrät.
 *
 * ── Die Überlegung dahinter ───────────────────────────────────
 *
 * Ein Check-in nennt keine Dimension. Er sagt „passt gut" oder „passt
 * wenig". Zusammen mit den Dimensionen der Stelle wird daraus eine
 * Aussage über die Person:
 *
 *   Jemand ist nach neunzig Tagen in einer Stelle mit hohem Tempo und
 *   viel Kundenkontakt unzufrieden → das ist ein Hinweis, dass ihm
 *   beides nicht liegt.
 *
 * Das ist die einzige Angabe im ganzen Profil, die nicht auf einer
 * Selbstauskunft beruht — deshalb wiegt sie am schwersten.
 *
 * ── Warum nur die Ränder zählen ───────────────────────────────
 *
 * „teils" (3 von 5) sagt nichts. Nur eine deutliche Zufriedenheit oder
 * Unzufriedenheit trägt einen Schluss, und auch dann nur für
 * Dimensionen, die in der Anzeige belegt sind.
 *
 * ── Warum das kein Urteil über den Arbeitgeber ist ────────────
 *
 * Es fliesst ausschliesslich ins eigene Profil. Über die Stelle wird
 * daraus nichts abgeleitet und an niemanden gemeldet.
 */
async function twinAusCheckIn(
  userId: string,
  jobId: string,
  marke: number,
  wert: number,
): Promise<void> {
  /* Erst ab 90 Tagen: In der Probezeit sagt Zufriedenheit wenig. */
  if (marke < 90) return;
  if (wert === 3) return;

  try {
    const db = await getDb();
    const [zeile] = await withUser(db, userId, (tx) =>
      tx.select().from(schema.jobs).where(eq(schema.jobs.id, jobId)).limit(1),
    );
    if (!zeile) return;

    const job = rowToJob(zeile as never, "", zeile.descriptionTokens);
    const dimensionen = stellenDimensionen(job).filter((d) => d.sicherheit > 0.5);
    if (dimensionen.length === 0) return;

    /*
     * Zufrieden zieht zur Stelle hin, unzufrieden davon weg.
     *
     * Die Stärke hängt am Abstand zur Mitte: „sehr gut" (5) und „gar
     * nicht" (1) verschieben um 0,3, „gut" und „wenig" um 0,15. Ein
     * einzelner Check-in soll ein Profil bewegen, nicht umwerfen.
     */
    const zufrieden = wert > 3;
    /*
     * Die Stärke hängt am Abstand zur Mitte: „sehr gut" und „gar nicht"
     * verschieben doppelt so stark wie „gut" und „wenig". Ein einzelner
     * Check-in soll ein Profil bewegen, nicht umwerfen.
     */
    const staerke = Math.abs(wert - 3) * 0.15;

    for (const d of dimensionen) {
      /*
       * Zufrieden: der Wert der Stelle passt offenbar — er wird als
       * Angabe über die Person übernommen.
       *
       * Unzufrieden: der Wert der Stelle passt nicht — die Person zieht
       * zum anderen Ende, aber nur um `staerke`. Ein einziger schlechter
       * Check-in macht aus „mag Tempo" nicht „hasst Tempo"; er verschiebt.
       */
      const wertFuerPerson = zufrieden
        ? d.wert
        : Math.min(1, Math.max(0, d.wert + (d.wert > 0.5 ? -staerke * 2 : staerke * 2)));

      await angabeErfassen(
        userId,
        d.dimension,
        wertFuerPerson,
        "beobachtet",
        `Nach ${marke} Tagen in einer Stelle mit „${d.beleg}" — Rückmeldung: ${
          zufrieden ? "passt gut" : "passt wenig"
        }`,
      );
    }
  } catch (e) {
    /* Ein Fehler hier darf den Check-in nicht entwerten. */
    console.error("[arbeitsprofil] aus Check-in nicht abgeleitet:", e);
  }
}
