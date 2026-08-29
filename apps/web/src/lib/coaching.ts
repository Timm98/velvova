"use server";

import { getDb, schema, withUser } from "@paycheck/db";
import { selectProvider } from "@paycheck/ai";
import { isConfirmedFact } from "@paycheck/domain";
import { loadRuntimeConfig } from "@paycheck/config";
import { and, asc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";

/**
 * Gespraechsvorbereitung.
 *
 * Bewertet werden ausschliesslich Inhalt und Aufbau einer Antwort. Nicht
 * Stimme, Gesicht, Akzent, Wirkung oder vermeintliche Ehrlichkeit - das
 * kann niemand seriös beurteilen, und im Beschaeftigungskontext waere es
 * ausserdem unzulaessig.
 */

export interface CoachingView {
  sessionId: string;
  job: { id: string; title: string; companyName: string } | null;
  questions: { key: string; text: string; origin: string }[];
  turns: { id: string; role: string; content: string; questionKey: string | null }[];
  feedback: {
    turnId: string;
    relevance: string | null;
    structure: string | null;
    concreteEvidence: string | null;
    clarity: string | null;
    missingPoints: string[];
  }[];
  starStories: { id: string; statement: string }[];
  questionsForCompany: string[];
  providerIsMock: boolean;
}

/**
 * Die Fragen entstehen aus der konkreten Stelle und dem Profil - nicht
 * aus einer allgemeinen Liste. Woher jede Frage kommt, steht dabei.
 */
function buildQuestions(
  job: typeof schema.jobs.$inferSelect | null,
  requirements: (typeof schema.jobRequirements.$inferSelect)[],
  themes: (typeof schema.reviewThemes.$inferSelect)[],
): { key: string; text: string; origin: string }[] {
  const questions: { key: string; text: string; origin: string }[] = [];

  questions.push({
    key: "why_this_role",
    text: "Warum interessiert Sie genau diese Rolle?",
    origin: "Standardfrage in nahezu jedem Erstgespraech",
  });

  for (const r of requirements.filter((r) => r.kind === "must").slice(0, 3)) {
    questions.push({
      key: `must_${r.id}`,
      text: `Die Stelle verlangt: "${r.text}". Erzaehlen Sie von einer Situation, in der Sie das gebraucht haben.`,
      origin: "Muss-Anforderung aus der Anzeige",
    });
  }

  for (const task of (job?.coreTasks ?? []).slice(0, 2)) {
    questions.push({
      key: `task_${task.slice(0, 20)}`,
      text: `Eine Kernaufgabe ist: "${task}". Wie sind Sie so etwas bisher angegangen?`,
      origin: "Kernaufgabe aus der Anzeige",
    });
  }

  const workload = themes.find((t) => /belastung|ueberstunden|druck/i.test(t.theme));
  if (workload) {
    questions.push({
      key: "pressure",
      text: "Erzaehlen Sie von einer Phase mit hohem Druck. Wie sind Sie damit umgegangen?",
      origin: "Aus Mitarbeiterstimmen: Arbeitsbelastung wird mehrfach genannt",
    });
  }

  questions.push({
    key: "failure",
    text: "Was ist zuletzt schiefgegangen, und was haben Sie daraus mitgenommen?",
    origin: "Standardfrage; prueft Selbsteinschaetzung und Lernen",
  });

  return questions;
}

/** Rueckfragen an das Unternehmen, abgeleitet aus dem, was unklar ist. */
function buildCompanyQuestions(
  job: typeof schema.jobs.$inferSelect | null,
  themes: (typeof schema.reviewThemes.$inferSelect)[],
): string[] {
  const out: string[] = [];
  if (job && !job.salaryDisclosed) out.push("In welchem Rahmen bewegt sich das Gehalt fuer diese Position?");
  if (job && job.coreTasks.length === 0) out.push("Wie sieht ein typischer Arbeitstag in dieser Rolle aus?");
  const negative = themes.filter((t) => t.sentiment === "negative");
  for (const t of negative.slice(0, 2)) {
    out.push(`Zum Thema "${t.theme}" gibt es unterschiedliche Rueckmeldungen. Wie erleben Sie das im Team?`);
  }
  out.push("Woran wuerden Sie nach sechs Monaten merken, dass die Besetzung gut war?");
  return out;
}

export async function loadCoaching(applicationId: string): Promise<CoachingView | null> {
  const user = await requireUser();
  const db = await getDb();
  const cfg = loadRuntimeConfig();
  const { provider } = await selectProvider(cfg);

  return withUser(db, user.id, async (tx) => {
    const [app] = await tx
      .select({ app: schema.applications, job: schema.jobs, company: schema.companies })
      .from(schema.applications)
      .innerJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
      .innerJoin(schema.companies, eq(schema.companies.id, schema.jobs.companyId))
      .where(and(eq(schema.applications.id, applicationId), eq(schema.applications.userId, user.id)))
      .limit(1);

    if (!app) return null;

    let [session] = await tx
      .select()
      .from(schema.coachingSessions)
      .where(
        and(
          eq(schema.coachingSessions.userId, user.id),
          eq(schema.coachingSessions.applicationId, applicationId),
        ),
      )
      .limit(1);

    if (!session) {
      [session] = await tx
        .insert(schema.coachingSessions)
        .values({
          userId: user.id,
          applicationId,
          jobId: app.job.id,
          mode: "practice",
          channel: "text",
          locale: user.locale,
        })
        .returning();
    }

    const [requirements, themes, turns, evidence] = await Promise.all([
      tx.select().from(schema.jobRequirements).where(eq(schema.jobRequirements.jobId, app.job.id)),
      tx.select().from(schema.reviewThemes).where(eq(schema.reviewThemes.companyId, app.company.id)),
      tx
        .select()
        .from(schema.coachingTurns)
        .where(eq(schema.coachingTurns.sessionId, session!.id))
        .orderBy(asc(schema.coachingTurns.index)),
      tx
        .select()
        .from(schema.evidenceItems)
        .where(and(eq(schema.evidenceItems.userId, user.id), isNull(schema.evidenceItems.deletedAt))),
    ]);

    const feedbackRows =
      turns.length > 0
        ? await tx.select().from(schema.coachingFeedback)
        : [];

    return {
      sessionId: session!.id,
      job: { id: app.job.id, title: app.job.title, companyName: app.company.name },
      questions: buildQuestions(app.job, requirements, themes),
      turns: turns.map((t) => ({ id: t.id, role: t.role, content: t.content, questionKey: t.questionKey })),
      feedback: feedbackRows
        .filter((f) => turns.some((t) => t.id === f.turnId))
        .map((f) => ({
          turnId: f.turnId,
          relevance: f.relevance,
          structure: f.structure,
          concreteEvidence: f.concreteEvidence,
          clarity: f.clarity,
          missingPoints: f.missingPoints,
        })),
      // STAR-Geschichten kommen ausschliesslich aus bestaetigter Evidenz.
      starStories: evidence
        .map((e) => ({
          id: e.id, userId: e.userId, type: e.type, statement: e.statement,
          sourceType: e.sourceType, sourceRef: e.sourceRef, confidence: e.confidence,
          userConfirmed: e.userConfirmed, userRejected: e.userRejected,
          sensitivityLevel: e.sensitivityLevel, retentionClass: e.retentionClass,
          createdAt: e.createdAt, updatedAt: e.updatedAt, deletedAt: e.deletedAt,
        }))
        .filter(isConfirmedFact)
        .filter((e) => e.type === "experience_episode" || e.type === "result")
        .map((e) => ({ id: e.id, statement: e.statement })),
      questionsForCompany: buildCompanyQuestions(app.job, themes),
      providerIsMock: provider.isLocal,
    };
  });
}

/**
 * Eine Antwort auswerten. Die Kriterien stehen vorher fest und werden
 * dem Menschen gezeigt - es gibt keine verborgene Bewertung.
 */
export async function submitCoachingAnswer(
  sessionId: string,
  questionKey: string,
  answer: string,
): Promise<{ ok: boolean; message: string }> {
  const user = await requireUser();
  const trimmed = answer.trim();
  if (trimmed.length < 10) return { ok: false, message: "Die Antwort ist zu kurz fuer eine Rueckmeldung." };

  const db = await getDb();

  await withUser(db, user.id, async (tx) => {
    const existing = await tx
      .select({ index: schema.coachingTurns.index })
      .from(schema.coachingTurns)
      .where(eq(schema.coachingTurns.sessionId, sessionId));
    const nextIndex = existing.length + 1;

    const [turn] = await tx
      .insert(schema.coachingTurns)
      .values({ sessionId, index: nextIndex, role: "user", content: trimmed, questionKey })
      .returning();

    // Auswertung entlang der offen gezeigten Kriterien.
    const hasSituation = /\b(als|damals|einmal|in meinem|bei meinem|waehrend)\b/i.test(trimmed);
    const hasAction = /\b(ich habe|ich hab|ich bin|daraufhin|also|dann)\b/i.test(trimmed);
    const hasResult = /\b(ergebnis|dadurch|am ende|schliesslich|seitdem|\d+\s*(prozent|%|stunden|tage|kunden))\b/i.test(trimmed);
    const isLong = trimmed.length > 200;

    const missing: string[] = [];
    if (!hasSituation) missing.push("Der konkrete Anlass fehlt: wann und wo war das?");
    if (!hasAction) missing.push("Was genau DU getan hast, bleibt unklar.");
    if (!hasResult) missing.push("Das Ergebnis fehlt. Auch ein grobes zaehlt.");

    await tx.insert(schema.coachingFeedback).values({
      turnId: turn!.id,
      relevance: trimmed.length > 40 ? "Die Antwort geht auf die Frage ein." : "Die Antwort bleibt sehr knapp.",
      structure: hasSituation && hasAction && hasResult
        ? "Situation, Handlung und Ergebnis sind erkennbar."
        : "Der Aufbau nach Situation, Handlung und Ergebnis ist noch nicht vollstaendig.",
      concreteEvidence: hasResult
        ? "Es steht ein nachvollziehbares Ergebnis darin."
        : "Ein konkretes Ergebnis fehlt noch.",
      clarity: isLong
        ? "Die Antwort ist ausfuehrlich. Pruef, ob der Kern in den ersten zwei Saetzen steht."
        : "Die Laenge ist angemessen.",
      missingPoints: missing,
      suggestedEvidenceIds: [],
    });
  });

  revalidatePath("/app/coaching");
  return { ok: true, message: "Rueckmeldung erstellt." };
}

