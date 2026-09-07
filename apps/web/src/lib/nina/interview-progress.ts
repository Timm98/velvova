import { and, desc, eq } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { QUESTIONS, nextStep } from "@paycheck/ai";

/**
 * Den Interviewfortschritt aus einer freien Antwort fortschreiben.
 *
 * Das Gespräch mit Monday läuft seit dem Umbau über die Chat-Route und
 * nicht mehr über ein Formular mit fester Frage. Damit ist eine
 * Verbindung gerissen, die niemand sieht: die Sperre vor personalisierten
 * Vorschlägen zählt abgeschlossene THEMEN in `interview_sessions`, und
 * die wurden ausschließlich vom alten Formularweg gesetzt.
 *
 * Folge: man konnte beliebig lange mit Monday sprechen, und die Sperre
 * blieb zu. Nicht weil zu wenig gesagt wurde, sondern weil es an der
 * falschen Stelle ankam.
 *
 * Diese Funktion schlägt die Brücke. Sie wird von der Chat-Route nach
 * jeder Nutzernachricht aufgerufen und tut drei Dinge:
 *
 *   1. den Zug im Interviewverlauf vermerken (mit der Frage, die
 *      gerade offen war),
 *   2. die Antwort als UNBESTÄTIGTE Evidenz ablegen,
 *   3. das Thema abschließen, wenn alle seine Fragen gestellt wurden.
 *
 * Was sie ausdrücklich nicht tut: aus einer Antwort einen bestätigten
 * Fakt machen. Das bleibt beim Menschen.
 */
export async function recordInterviewAnswer(
  userId: string,
  antwort: string,
  locale: "de" | "en",
): Promise<{ stage: string; questionKey: string | null } | null> {
  const inhalt = antwort.trim();
  if (inhalt.length === 0) return null;

  const db = await getDb();

  return withUser(db, userId, async (tx) => {
    const [vorhanden] = await tx
      .select()
      .from(schema.interviewSessions)
      .where(
        and(
          eq(schema.interviewSessions.userId, userId),
          eq(schema.interviewSessions.status, "active"),
        ),
      )
      .orderBy(desc(schema.interviewSessions.updatedAt))
      .limit(1);

    const sitzung =
      vorhanden ??
      (
        await tx
          .insert(schema.interviewSessions)
          .values({ userId, locale, mode: "text", stage: "consent_and_goal", status: "active" })
          .returning()
      )[0]!;

    const gestellt = await tx
      .select({ questionKey: schema.interviewTurns.questionKey })
      .from(schema.interviewTurns)
      .where(eq(schema.interviewTurns.sessionId, sitzung.id));
    const gestellteSchlüssel = gestellt.map((g) => g.questionKey).filter(Boolean) as string[];

    /*
     * Welche Frage war offen?
     *
     * Der Schrittrechner kennt die Reihenfolge der Themen. Er bekommt
     * hier keine Evidenz mit — das ist Absicht: für die Zuordnung
     * „welche Frage wurde gerade beantwortet“ zählt nur, was schon
     * gestellt wurde, nicht was daraus geworden ist.
     */
    const schritt = nextStep({
      session: {
        id: sitzung.id,
        userId,
        mode: sitzung.mode as "text" | "voice",
        locale: sitzung.locale,
        stage: sitzung.stage,
        completedStages: (sitzung.completedStages ?? []) as never,
        skippedStages: (sitzung.skippedStages ?? []) as never,
        status: sitzung.status,
        startedAt: sitzung.startedAt,
        updatedAt: sitzung.updatedAt,
        completedAt: sitzung.completedAt,
      },
      evidence: [],
      locale: sitzung.locale,
      askedKeys: gestellteSchlüssel,
      skippedKeys: (sitzung.skippedStages ?? []) as string[],
    });

    const [letzter] = await tx
      .select({ index: schema.interviewTurns.index })
      .from(schema.interviewTurns)
      .where(eq(schema.interviewTurns.sessionId, sitzung.id))
      .orderBy(desc(schema.interviewTurns.index))
      .limit(1);

    await tx.insert(schema.interviewTurns).values({
      sessionId: sitzung.id,
      userId,
      index: (letzter?.index ?? 0) + 1,
      role: "user",
      stage: schritt.stage,
      questionKey: schritt.questionKey,
      content: inhalt.slice(0, 5000),
    });

    // Kurze Antworten erzeugen keine Evidenz. „Ja“ ist keine Erfahrung,
    // und ein Beleg, der aus einem Wort besteht, hält im Gespräch mit
    // einem Arbeitgeber nicht stand.
    const frage = QUESTIONS.find((q) => q.key === schritt.questionKey);
    if (frage && inhalt.length >= 20) {
      const typ = (frage.yields[0] ??
        "experience_episode") as (typeof schema.evidenceItems.$inferInsert)["type"];
      await tx.insert(schema.evidenceItems).values({
        userId,
        type: typ,
        statement: inhalt.slice(0, 1000),
        sourceType: "user_stated",
        sourceRef: `interview:${schritt.stage}:${schritt.questionKey}`,
        confidence: 0.8,
        // Ausdrücklich nicht bestätigt. Das ist der ganze Punkt.
        userConfirmed: false,
      });
    }

    const alleSchlüssel = new Set([...gestellteSchlüssel, schritt.questionKey].filter(Boolean));
    const themenfragen = QUESTIONS.filter((q) => q.stage === schritt.stage);
    const themaFertig = themenfragen.every((q) => alleSchlüssel.has(q.key));

    const fertig = new Set((sitzung.completedStages ?? []) as string[]);
    if (themaFertig) fertig.add(schritt.stage);

    await tx
      .update(schema.interviewSessions)
      .set({ completedStages: [...fertig], stage: schritt.stage, updatedAt: new Date() })
      .where(eq(schema.interviewSessions.id, sitzung.id));

    return { stage: schritt.stage, questionKey: schritt.questionKey };
  });
}
