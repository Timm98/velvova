import { getDb, schema, withUser } from "@paycheck/db";
import { and, eq, isNull, lte } from "drizzle-orm";

/**
 * Erinnerungen an fällige Check-ins.
 *
 * ── Warum ohne sie nichts funktioniert ────────────────────────
 *
 * Der Outcome Loop lernt aus Check-ins. Check-ins füllt niemand von
 * selbst aus — nicht aus Unwillen, sondern weil nach neunzig Tagen im
 * neuen Job niemand daran denkt, dass es eine Seite gibt, auf der man
 * etwas dazu sagen könnte.
 *
 * Ohne Anstoss keine Check-ins. Ohne Check-ins kein beobachteter
 * Career Twin und keine Bilanz. Die Tabelle `reminders` gab es von
 * Anfang an, die Startseite liest sie — geschrieben hat nie jemand
 * hinein.
 *
 * ── Warum 30, 90 und 180 ──────────────────────────────────────
 *
 * Die ersten dreissig Tage zeigen, ob die Anzeige gestimmt hat. Neunzig
 * zeigen, ob die Arbeit trägt. Hundertachtzig liegen hinter der
 * Probezeit — und erst dort trennt sich, ob eine Empfehlung getaugt
 * hat. Wer noch in der Probezeit ist, will die Stelle meistens behalten.
 *
 * ── Warum kein Versand ────────────────────────────────────────
 *
 * Sie erscheinen in der Anwendung, wenn sie fällig sind. Keine E-Mail,
 * keine Benachrichtigung aufs Gerät: Eine Frage nach der Zufriedenheit
 * im neuen Job ist nichts, was ungefragt in einen Posteingang gehört.
 */

const MARKEN = [30, 90, 180] as const;

/*
 * Der Promise Lock prüft früher.
 *
 * Der Check-in fragt nach Zufriedenheit — die braucht Zeit. Eine
 * gebrochene Zusage fällt früher auf: Wer nach vierzehn Tagen keine
 * Einarbeitung hat, hat keine.
 */
const ZUSAGENMARKEN = [14, 30, 90] as const;
const TAG_MS = 86_400_000;

/**
 * Legt die drei Erinnerungen an, wenn jemand eine Stelle antritt.
 *
 * Fällt still aus, wenn es sie schon gibt: Ein zweites `accepted` —
 * etwa nach einer Korrektur — soll keine sechs Termine erzeugen.
 */
export async function checkInsPlanen(
  userId: string,
  applicationId: string,
  ab = new Date(),
): Promise<void> {
  const db = await getDb();
  try {
    const vorhanden = await withUser(db, userId, (tx) =>
      tx
        .select({ id: schema.reminders.id })
        .from(schema.reminders)
        .where(
          and(
            eq(schema.reminders.userId, userId),
            eq(schema.reminders.applicationId, applicationId),
            eq(schema.reminders.kind, "check_in"),
          ),
        )
        .limit(1),
    );
    if (vorhanden.length > 0) return;

    await withUser(db, userId, (tx) =>
      tx.insert(schema.reminders).values([
        ...MARKEN.map((tage) => ({
          userId,
          applicationId,
          kind: "check_in",
          dueAt: new Date(ab.getTime() + tage * TAG_MS),
          label: `Wie läuft es nach ${tage} Tagen?`,
          /*
           * Kein Entwurfstext.
           *
           * `draftMessage` ist für Nachrichten an Arbeitgeber gedacht.
           * Ein Check-in geht an niemanden — er bleibt beim Menschen.
           */
          draftMessage: null,
        })),
        ...ZUSAGENMARKEN.map((tage) => ({
          userId,
          applicationId,
          kind: "zusagen_pruefung",
          dueAt: new Date(ab.getTime() + tage * TAG_MS),
          label: `Stimmt nach ${tage} Tagen, was dir zugesagt wurde?`,
          draftMessage: null,
        })),
      ]),
    );
  } catch (e) {
    /* Ein Fehler hier darf den Stellenantritt nicht aufhalten. */
    console.error("[erinnerungen] Check-ins nicht geplant:", e);
  }
}

/**
 * Schliesst die fällige Erinnerung, wenn ein Check-in abgegeben wurde.
 *
 * Nur die, deren Marke erreicht ist: Wer nach 30 Tagen antwortet, soll
 * nicht auch die 90-Tage-Erinnerung verlieren.
 */
export async function checkInAbgehakt(
  userId: string,
  applicationId: string,
  tagesmarke: number,
): Promise<void> {
  const db = await getDb();
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.reminders)
      .set({ completedAt: new Date() })
      .where(
        and(
          eq(schema.reminders.userId, userId),
          eq(schema.reminders.applicationId, applicationId),
          eq(schema.reminders.kind, "check_in"),
          eq(schema.reminders.label, `Wie läuft es nach ${tagesmarke} Tagen?`),
          isNull(schema.reminders.completedAt),
        ),
      ),
  ).catch((e) => console.error("[erinnerungen] nicht abgehakt:", e));
}

export interface FaelligeErinnerung {
  id: string;
  applicationId: string | null;
  label: string;
  dueAt: Date;
  titel: string;
  firma: string;
}

/**
 * Was jetzt fällig ist — nicht, was irgendwann kommt.
 *
 * Eine Erinnerung, die in sechzig Tagen ansteht, ist keine Erinnerung,
 * sondern ein Termin. Sie auf der Startseite zu zeigen hiesse, jemanden
 * an etwas zu erinnern, das er noch gar nicht tun kann.
 */
export async function faelligeCheckIns(userId: string): Promise<FaelligeErinnerung[]> {
  const db = await getDb();
  return await withUser(db, userId, (tx) =>
    tx
      .select({
        id: schema.reminders.id,
        applicationId: schema.reminders.applicationId,
        label: schema.reminders.label,
        dueAt: schema.reminders.dueAt,
        titel: schema.jobs.title,
        firma: schema.companies.name,
      })
      .from(schema.reminders)
      .innerJoin(schema.applications, eq(schema.applications.id, schema.reminders.applicationId))
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(
        and(
          eq(schema.reminders.userId, userId),
          eq(schema.reminders.kind, "check_in"),
          isNull(schema.reminders.completedAt),
          isNull(schema.reminders.dismissedAt),
          lte(schema.reminders.dueAt, new Date()),
        ),
      )
      .orderBy(schema.reminders.dueAt),
  ).catch(() => []);
}
