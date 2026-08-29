import { getDb, schema, withUser } from "@paycheck/db";
import { evaluateGate, type InterviewStage, type MinimumProfileGate } from "@paycheck/domain";
import { eq } from "drizzle-orm";

/**
 * Der Riegel vor personalisierten Jobvorschlägen.
 *
 * Wichtig: die Abdeckung ist eine Eigenschaft des Menschen, nicht einer
 * einzelnen Gesprächssitzung. Wer ein zweites Gespräch beginnt, verliert
 * sein Profil nicht - genau das ist beim ersten Rauchtest passiert, weil
 * die Prüfung an der zuletzt aktualisierten Sitzung hing.
 *
 * Deshalb werden die abgeschlossenen Themen über ALLE Sitzungen
 * zusammengefasst.
 */
export async function loadGate(userId: string): Promise<MinimumProfileGate & { hasAnySession: boolean }> {
  const db = await getDb();

  const { sessions, profileConfirmed } = await withUser(db, userId, async (tx) => ({
    sessions: await tx
      .select({
        id: schema.interviewSessions.id,
        completedStages: schema.interviewSessions.completedStages,
        skippedStages: schema.interviewSessions.skippedStages,
        status: schema.interviewSessions.status,
        startedAt: schema.interviewSessions.startedAt,
        updatedAt: schema.interviewSessions.updatedAt,
        completedAt: schema.interviewSessions.completedAt,
        stage: schema.interviewSessions.stage,
        locale: schema.interviewSessions.locale,
        mode: schema.interviewSessions.mode,
        userId: schema.interviewSessions.userId,
      })
      .from(schema.interviewSessions)
      .where(eq(schema.interviewSessions.userId, userId)),
    profileConfirmed:
      (
        await tx
          .select({ confirmed: schema.careerProfiles.confirmedByUser })
          .from(schema.careerProfiles)
          .where(eq(schema.careerProfiles.userId, userId))
          .limit(1)
      )[0]?.confirmed ?? false,
  }));

  if (sessions.length === 0) {
    return { ...evaluateGate(null, false), hasAnySession: false };
  }

  // Vereinigung über alle Sitzungen.
  const completed = new Set<string>();
  const skipped = new Set<string>();
  for (const s of sessions) {
    for (const stage of (s.completedStages ?? []) as string[]) completed.add(stage);
    for (const stage of (s.skippedStages ?? []) as string[]) skipped.add(stage);
  }

  const newest = sessions.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b));

  const merged = {
    id: newest.id,
    userId,
    mode: newest.mode === "voice" ? ("voice" as const) : ("text" as const),
    locale: newest.locale,
    stage: newest.stage,
    completedStages: [...completed] as InterviewStage[],
    skippedStages: [...skipped] as InterviewStage[],
    status: newest.status,
    startedAt: newest.startedAt,
    updatedAt: newest.updatedAt,
    completedAt: newest.completedAt,
  };

  return { ...evaluateGate(merged, profileConfirmed), hasAnySession: true };
}
