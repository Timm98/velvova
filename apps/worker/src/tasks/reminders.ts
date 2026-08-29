import { getDb, schema } from "@paycheck/db";
import { and, eq, isNull, lt, sql } from "drizzle-orm";

/**
 * Erinnerungen und Nachfassen.
 *
 * Wichtig ist die Zurueckhaltung: es entsteht ein VORSCHLAG, den der
 * Mensch bearbeiten und verwerfen kann. Es wird nichts automatisch
 * verschickt, und es gibt keine Erinnerungsflut - je Bewerbung hoechstens
 * eine offene Erinnerung.
 */

const FOLLOW_UP_AFTER_DAYS = 10;

export interface ReminderResult {
  angelegt: number;
  uebersprungen: number;
}

export async function createFollowUpReminders(now = new Date()): Promise<ReminderResult> {
  const db = await getDb();
  const cutoff = new Date(now.getTime() - FOLLOW_UP_AFTER_DAYS * 86_400_000);

  const candidates = await db
    .select({
      id: schema.applications.id,
      userId: schema.applications.userId,
      lastContactAt: schema.applications.lastContactAt,
      jobTitle: schema.jobs.title,
      company: schema.companies.name,
    })
    .from(schema.applications)
    .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
    .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
    .where(and(eq(schema.applications.stage, "sent"), lt(schema.applications.lastContactAt, cutoff)));

  let angelegt = 0;
  let uebersprungen = 0;

  for (const app of candidates) {
    const existing = await db
      .select({ id: schema.reminders.id })
      .from(schema.reminders)
      .where(
        and(
          eq(schema.reminders.applicationId, app.id),
          eq(schema.reminders.kind, "follow_up"),
          isNull(schema.reminders.completedAt),
          isNull(schema.reminders.dismissedAt),
        ),
      )
      .limit(1);

    if (existing[0]) {
      uebersprungen++;
      continue;
    }

    await db.insert(schema.reminders).values({
      userId: app.userId,
      applicationId: app.id,
      kind: "follow_up",
      dueAt: now,
      label: `Nachfassen bei ${app.company}`,
      // Ein Vorschlag, kein fertiger Versand. Hoeflich und knapp.
      draftMessage:
        `Guten Tag,\n\nvor einiger Zeit habe ich mich auf die Stelle "${app.jobTitle}" beworben. ` +
        `Ich wollte hoeflich nachfragen, ob es zum Verfahren einen Stand gibt.\n\n` +
        `Ueber eine kurze Rueckmeldung freue ich mich.\n\nMit freundlichen Gruessen`,
    });
    angelegt++;
  }

  return { angelegt, uebersprungen };
}

/** Check-ins nach Jobstart. Nur fuer angenommene Stellen. */
export async function createCheckInReminders(now = new Date()): Promise<number> {
  const db = await getDb();
  const result = await db.execute(sql`
    INSERT INTO reminders (user_id, application_id, kind, due_at, label)
    SELECT a.user_id, a.id, 'check_in',
           a.updated_at + (mark || ' days')::interval,
           'Check-in nach ' || mark || ' Tagen'
    FROM applications a
    CROSS JOIN (VALUES (30), (60), (90)) AS marks(mark)
    WHERE a.stage = 'accepted'
      AND a.updated_at + (mark || ' days')::interval <= ${now}
      AND NOT EXISTS (
        SELECT 1 FROM reminders r
        WHERE r.application_id = a.id AND r.kind = 'check_in'
          AND r.label = 'Check-in nach ' || mark || ' Tagen'
      )
  `);
  return (result as unknown as { rowCount?: number }).rowCount ?? 0;
}
