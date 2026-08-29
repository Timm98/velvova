import type { InterviewSession, InterviewStage } from "@paycheck/domain";
import type { schema } from "@paycheck/db";

/**
 * Uebersetzt Datenbankzeilen in Domänentypen.
 *
 * Die Datenbank kennt etwa `mode` nur als Text; die Domäne kennt genau
 * zwei erlaubte Werte. Statt an der Aufrufstelle zu casten, findet die
 * Umwandlung an einer Stelle statt - dann fällt auch auf, wenn ein
 * unerwarteter Wert in der Datenbank steht.
 */

type InterviewSessionRow = typeof schema.interviewSessions.$inferSelect;

export function toInterviewSession(row: InterviewSessionRow | undefined | null): InterviewSession | null {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    mode: row.mode === "voice" ? "voice" : "text",
    locale: row.locale,
    stage: row.stage,
    completedStages: (row.completedStages ?? []) as InterviewStage[],
    skippedStages: (row.skippedStages ?? []) as InterviewStage[],
    status: row.status,
    startedAt: row.startedAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  };
}
