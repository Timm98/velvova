import { getDb, schema, withUser, type Database } from "@paycheck/db";
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
  return withUser(db, userId, (tx) => gateAusTx(tx, userId));
}

/**
 * Derselbe Riegel, aber in einer bereits offenen Transaktion.
 *
 * ── Warum es beide Wege gibt ─────────────────────────────────
 *
 * Eine `withUser`-Transaktion sind vier Netzrunden gegen Supabase:
 * BEGIN, Rolle setzen, Abfrage, COMMIT. Die Stellenseite braucht sechs
 * solche Lesevorgänge — als sechs Transaktionen sind das
 * vierundzwanzig Runden, von denen achtzehn nur Verwaltung sind.
 *
 * Wer schon eine Transaktion offen hat, ruft diese Funktion auf und
 * zahlt die Verwaltung einmal für alle.
 *
 * An der Zugriffstrennung ändert das nichts: Die Transaktion, die
 * hereingereicht wird, hat Rolle und Nutzerkennung gesetzt — sonst
 * wäre sie keine aus `withUser`. Die Zeilensicherheit hängt an der
 * Sitzung, nicht daran, wer die Abfrage formuliert.
 */
export async function gateAusTx(
  tx: Database,
  userId: string,
): Promise<MinimumProfileGate & { hasAnySession: boolean }> {
  /*
   * Beide Abfragen zusammen abgeschickt.
   *
   * Vorher standen sie als zwei `await` in einem Objektliteral. Ein
   * Hinweis dazu, weil er anderswo falsch dokumentiert ist: Innerhalb
   * EINER Transaktion macht `Promise.all` die Abfragen nicht
   * gleichzeitig — eine Verbindung arbeitet nacheinander. Gemessen an
   * der Stellenseite: sechs Lesevorgänge in einer Transaktion 575 ms,
   * dieselben in drei nebeneinander laufenden 357 ms.
   *
   * Es bleibt trotzdem besser als zwei `await`: Der Treiber schickt
   * beide los, ohne auf die erste Antwort zu warten. Was es NICHT
   * ist, ist echte Nebenläufigkeit.
   */
  const [sessions, profilzeile] = await Promise.all([
    tx
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
    tx
      .select({ confirmed: schema.careerProfiles.confirmedByUser })
      .from(schema.careerProfiles)
      .where(eq(schema.careerProfiles.userId, userId))
      .limit(1),
  ]);
  const profileConfirmed = profilzeile[0]?.confirmed ?? false;

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
