"use server";

import { getDb, schema, withUser } from "@paycheck/db";
import { buildNinaSystemPrompt, checkOutput, minimiseForExternalProvider, route, selectProvider } from "@paycheck/ai";
import { QUESTIONS, nextStep, progressView } from "@paycheck/ai";
import { isConfirmedFact, type InterviewStage } from "@paycheck/domain";
import { loadRuntimeConfig } from "@paycheck/config";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { toInterviewSession } from "./rows";
import { requireUser } from "./auth";

/**
 * Der Ablauf des Karrieregesprächs auf der Serverseite.
 *
 * Was hier NICHT passiert: aus einer Antwort wird nicht automatisch ein
 * bestätigter Fakt. Jede abgeleitete Aussage entsteht als unbestätigte
 * Evidenz und wartet auf die Bestätigung des Menschen im Profil. Genau
 * das ist der Unterschied zu einem Chatprofil.
 */

export interface InterviewView {
  sessionId: string;
  turns: { id: string; role: "assistant" | "user" | "system"; content: string; questionKey: string | null }[];
  step: {
    kind: string;
    stage: InterviewStage;
    questionKey: string | null;
    text: string;
    stageLabel: string;
    purpose: string;
    canSkip: boolean;
  };
  progress: {
    understood: number;
    total: number;
    topics: { stage: string; label: string; state: string }[];
    minimumProfileReached: boolean;
    missingForMinimum: string[];
  };
  confirmedFacts: { id: string; statement: string }[];
  openHypotheses: { id: string; statement: string }[];
  voiceAvailable: boolean;
}

async function ensureSession(userId: string, locale: "de" | "en") {
  const db = await getDb();

  return withUser(db, userId, async (tx) => {
    const [existing] = await tx
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

    if (existing) return existing;

    const [created] = await tx
      .insert(schema.interviewSessions)
      .values({ userId, locale, mode: "text", stage: "consent_and_goal", status: "active" })
      .returning();
    return created!;
  });
}

export async function loadInterview(): Promise<InterviewView> {
  const user = await requireUser();
  const db = await getDb();
  const cfg = loadRuntimeConfig();

  const sessionRow = await ensureSession(user.id, user.locale);

  const [turns, evidence] = await withUser(db, user.id, async (tx) => [
    await tx
      .select()
      .from(schema.interviewTurns)
      .where(eq(schema.interviewTurns.sessionId, sessionRow.id))
      .orderBy(asc(schema.interviewTurns.index)),
    await tx
      .select()
      .from(schema.evidenceItems)
      .where(and(eq(schema.evidenceItems.userId, user.id), isNull(schema.evidenceItems.deletedAt))),
  ]);

  const session = toInterviewSession(sessionRow)!;
  const domainEvidence = evidence.map((e) => ({
    id: e.id,
    userId: e.userId,
    type: e.type,
    statement: e.statement,
    sourceType: e.sourceType,
    sourceRef: e.sourceRef,
    confidence: e.confidence,
    userConfirmed: e.userConfirmed,
    userRejected: e.userRejected,
    sensitivityLevel: e.sensitivityLevel,
    retentionClass: e.retentionClass,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    deletedAt: e.deletedAt,
  }));

  const state = {
    session,
    evidence: domainEvidence,
    locale: session.locale,
    askedKeys: turns.filter((t) => t.questionKey).map((t) => t.questionKey!),
    skippedKeys: [],
  };

  const step = nextStep(state);
  const progress = progressView(state);

  return {
    sessionId: sessionRow.id,
    turns: turns.map((t) => ({
      id: t.id,
      role: t.role,
      content: t.content,
      questionKey: t.questionKey,
    })),
    step,
    progress,
    confirmedFacts: domainEvidence
      .filter(isConfirmedFact)
      .map((e) => ({ id: e.id, statement: e.statement })),
    openHypotheses: domainEvidence
      .filter((e) => !e.userConfirmed && !e.userRejected)
      .map((e) => ({ id: e.id, statement: e.statement })),
    voiceAvailable: cfg.voice.provider !== "none",
  };
}

/**
 * Eine Antwort verarbeiten.
 *
 * Reihenfolge: Antwort speichern, Evidenz als UNBESTAETIGT ableiten,
 * Thema fortschreiben, nächste Frage bestimmen. Die Assistenz formuliert
 * die nächste Frage - sie entscheidet aber nicht, was als Fakt gilt.
 */
export async function submitAnswer(
  answer: string,
  questionKey: string | null,
  stage: InterviewStage,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const trimmed = answer.trim();
  if (trimmed.length === 0) return { ok: false, error: "Die Antwort ist leer." };
  if (trimmed.length > 5000) return { ok: false, error: "Die Antwort ist zu lang (max. 5000 Zeichen)." };

  const db = await getDb();
  const sessionRow = await ensureSession(user.id, user.locale);

  await withUser(db, user.id, async (tx) => {
    const [{ count } = { count: 0 }] = await tx
      .select({ count: schema.interviewTurns.index })
      .from(schema.interviewTurns)
      .where(eq(schema.interviewTurns.sessionId, sessionRow.id))
      .orderBy(desc(schema.interviewTurns.index))
      .limit(1);

    const nextIndex = (count ?? 0) + 1;

    await tx.insert(schema.interviewTurns).values({
      sessionId: sessionRow.id,
      userId: user.id,
      index: nextIndex,
      role: "user",
      stage,
      questionKey,
      content: trimmed,
    });

    // Die Antwort wird als unbestätigte Evidenz abgelegt. Sie zählt
    // erst, wenn der Mensch sie im Profil bestätigt.
    const question = QUESTIONS.find((q) => q.key === questionKey);
    if (question && trimmed.length >= 20) {
      const type = (question.yields[0] ?? "experience_episode") as (typeof schema.evidenceItems.$inferInsert)["type"];
      await tx.insert(schema.evidenceItems).values({
        userId: user.id,
        type,
        statement: trimmed.slice(0, 1000),
        sourceType: "user_stated",
        sourceRef: `interview:${stage}:${questionKey}`,
        confidence: 0.8,
        // Ausdrücklich nicht bestätigt. Das ist der ganze Punkt.
        userConfirmed: false,
      });
    }

    // Thema abschliessen, wenn keine offene Frage mehr übrig ist.
    const asked = await tx
      .select({ questionKey: schema.interviewTurns.questionKey })
      .from(schema.interviewTurns)
      .where(eq(schema.interviewTurns.sessionId, sessionRow.id));
    const askedKeys = new Set(asked.map((a) => a.questionKey).filter(Boolean));
    const stageQuestions = QUESTIONS.filter((q) => q.stage === stage);
    const allAsked = stageQuestions.every((q) => askedKeys.has(q.key));

    const completed = new Set(sessionRow.completedStages as string[]);
    if (allAsked) completed.add(stage);

    await tx
      .update(schema.interviewSessions)
      .set({ completedStages: [...completed], updatedAt: new Date() })
      .where(eq(schema.interviewSessions.id, sessionRow.id));
  });

  return { ok: true };
}

export async function skipQuestion(questionKey: string, stage: InterviewStage): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  const sessionRow = await ensureSession(user.id, user.locale);

  await withUser(db, user.id, async (tx) => {
    const [last] = await tx
      .select({ index: schema.interviewTurns.index })
      .from(schema.interviewTurns)
      .where(eq(schema.interviewTurns.sessionId, sessionRow.id))
      .orderBy(desc(schema.interviewTurns.index))
      .limit(1);

    await tx.insert(schema.interviewTurns).values({
      sessionId: sessionRow.id,
      userId: user.id,
      index: (last?.index ?? 0) + 1,
      role: "system",
      stage,
      questionKey,
      content: "Frage übersprungen.",
    });
  });
}

export async function skipStage(stage: InterviewStage): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  const sessionRow = await ensureSession(user.id, user.locale);

  await withUser(db, user.id, async (tx) => {
    const skipped = new Set(sessionRow.skippedStages as string[]);
    skipped.add(stage);
    await tx
      .update(schema.interviewSessions)
      .set({ skippedStages: [...skipped], updatedAt: new Date() })
      .where(eq(schema.interviewSessions.id, sessionRow.id));
  });
}

export async function pauseSession(): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  const sessionRow = await ensureSession(user.id, user.locale);
  await withUser(db, user.id, (tx) =>
    tx
      .update(schema.interviewSessions)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(schema.interviewSessions.id, sessionRow.id)),
  );
}

/**
 * Die nächste Äußerung der Assistenz. Der Systemprompt bekommt nur,
 * was er braucht - und vor der Uebergabe an einen externen Anbieter
 * werden direkte Identifikatoren entfernt.
 */
export async function assistantReply(userMessage: string): Promise<string> {
  const user = await requireUser();
  const cfg = loadRuntimeConfig();
  const provider = await selectProvider(cfg);
  const view = await loadInterview();

  const system = buildNinaSystemPrompt({
    locale: user.locale,
    confirmedFacts: view.confirmedFacts.map((f) => f.statement),
    openHypotheses: view.openHypotheses.map((h) => h.statement),
    hardConstraints: [],
    rejectedStatements: [],
    currentStage: view.step.stage,
    externalProviderActive: true,
  });

  // Vor der Übergabe an einen externen Anbieter werden direkte
  // Identifikatoren entfernt. Es gibt keinen lokalen Anbieter mehr, für
  // den man das überspringen könnte — die Bedingung wäre eine Ausnahme
  // ohne Fall.
  const content = minimiseForExternalProvider(userMessage);

  let text = "";
  for await (const chunk of provider.chatStream({
    system,
    messages: [{ role: "user", content }],
    // Die Stufe kommt aus dem Router, nicht aus dieser Datei. Die
    // Begründung steht dort, an einer Stelle, zusammen mit allen
    // anderen — das war vorher über das Projekt verteilt.
    tier: route("profile_synthesis").providerTier,
  })) {
    text += chunk;
  }

  // Ausgabeprüfung: eine Zuschreibung geschützter Merkmale wird
  // verworfen, nicht bereinigt.
  const violations = checkOutput(text);
  if (violations.length > 0) {
    return (
      "Diese Antwort wurde verworfen, weil sie eine unzulässige Zuschreibung enthielt. " +
      "Lass uns bei dem bleiben, was du selbst gesagt hast: erzähl mir mehr zu deiner letzten Antwort."
    );
  }

  return text.trim();
}

