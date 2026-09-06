import { eq, sql } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";

/**
 * Wo die Person stehengeblieben ist.
 *
 * Ein Datensatz pro Mensch, nicht pro Sitzung. Das ist der ganze
 * Unterschied zwischen „nach dem Neuladen wieder am Anfang“ und „genau
 * da weiter, wo ich war“ — und er entscheidet sich nicht im Frontend,
 * sondern daran, wo der Zustand liegt.
 */

export type InterviewStatus =
  | "not_started"
  | "in_progress"
  | "paused"
  | "completed"
  | "needs_review";

export type ProfileStatus =
  | "empty"
  | "draft"
  | "awaiting_confirmation"
  | "confirmed"
  | "outdated";

export interface WorkflowRecord {
  userId: string;
  onboardingComplete: boolean;
  careerInterviewStatus: InterviewStatus;
  careerInterviewCompletedAt: Date | null;
  careerProfileStatus: ProfileStatus;
  activeCareerProjectId: string | null;
  activeConversationId: string | null;
  currentWorkflowStep: string;
  lastActiveRoute: string | null;
  lastActiveJobId: string | null;
  lastActiveApplicationId: string | null;
  updatedAt: Date;
}

/**
 * Den Zustand holen und dabei anlegen, falls er fehlt.
 *
 * `onConflictDoNothing` statt einer Prüfung davor: zwei gleichzeitige
 * Anfragen desselben Menschen — der Normalfall beim ersten Laden einer
 * Seite mit mehreren Serverkomponenten — würden sonst beide „gibt es
 * nicht“ lesen und beide einfügen.
 */
export async function ensureWorkflowState(userId: string): Promise<WorkflowRecord> {
  const db = await getDb();

  return withUser(db, userId, async (tx) => {
    await tx
      .insert(schema.workflowStates)
      .values({ userId })
      .onConflictDoNothing({ target: schema.workflowStates.userId });

    const [row] = await tx
      .select()
      .from(schema.workflowStates)
      .where(eq(schema.workflowStates.userId, userId))
      .limit(1);

    return row as WorkflowRecord;
  });
}

/**
 * Eine Route so speichern, dass sie später gefahrlos wieder aufgerufen
 * werden kann.
 *
 * Der Anfrageteil fällt weg. Eine Suchanfrage in einer URL ist eine
 * Aussage über den Menschen („Teilzeit“, „Wiedereinstieg“), und sie hat
 * in einer Spalte nichts zu suchen, die beim nächsten Login automatisch
 * aufgerufen wird.
 */
export function sanitiseRoute(route: string | null | undefined): string | null {
  if (!route) return null;
  const ohneAnfrage = route.split("?")[0]!.split("#")[0]!;
  if (!ohneAnfrage.startsWith("/app")) return null;
  return ohneAnfrage.length > 200 ? null : ohneAnfrage;
}

export async function updateWorkflowState(
  userId: string,
  patch: Partial<Omit<WorkflowRecord, "userId" | "updatedAt">>,
): Promise<void> {
  await ensureWorkflowState(userId);
  const db = await getDb();

  const werte: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.onboardingComplete !== undefined) werte.onboardingComplete = patch.onboardingComplete;
  if (patch.careerInterviewStatus !== undefined) {
    werte.careerInterviewStatus = patch.careerInterviewStatus;
    // Die Datenbank erzwingt: abgeschlossen ohne Zeitpunkt geht nicht.
    // Hier wird der Zeitpunkt gesetzt, statt die Bedingung zu umgehen.
    if (patch.careerInterviewStatus === "completed" && patch.careerInterviewCompletedAt === undefined) {
      werte.careerInterviewCompletedAt = new Date();
    }
  }
  if (patch.careerInterviewCompletedAt !== undefined) {
    werte.careerInterviewCompletedAt = patch.careerInterviewCompletedAt;
  }
  if (patch.careerProfileStatus !== undefined) werte.careerProfileStatus = patch.careerProfileStatus;
  if (patch.activeCareerProjectId !== undefined) werte.activeCareerProjectId = patch.activeCareerProjectId;
  if (patch.activeConversationId !== undefined) werte.activeConversationId = patch.activeConversationId;
  if (patch.currentWorkflowStep !== undefined) werte.currentWorkflowStep = patch.currentWorkflowStep;
  if (patch.lastActiveRoute !== undefined) werte.lastActiveRoute = sanitiseRoute(patch.lastActiveRoute);
  if (patch.lastActiveJobId !== undefined) werte.lastActiveJobId = patch.lastActiveJobId;
  if (patch.lastActiveApplicationId !== undefined) {
    werte.lastActiveApplicationId = patch.lastActiveApplicationId;
  }

  await withUser(db, userId, (tx) =>
    tx.update(schema.workflowStates).set(werte).where(eq(schema.workflowStates.userId, userId)),
  );
}

/**
 * Wohin nach dem Login?
 *
 * Die eine Regel, die das Produkt bisher falsch hatte: ein
 * abgeschlossenes Interview landet **nicht** wieder im Interview. Wer
 * fertig ist, geht zur Jobliste; wer unterbrochen hat, macht dort
 * weiter, wo er aufgehört hat.
 *
 * Reine Funktion, damit die Regel prüfbar ist, ohne eine Sitzung zu
 * bauen.
 */
export function entryRoute(state: {
  onboardingComplete: boolean;
  careerInterviewStatus: InterviewStatus;
  lastActiveRoute: string | null;
}): string {
  /* Früher `/setup`. Die Seite ist Ninas Einrichtung geworden; sie
     schickt selbst weiter, sobald sie einmal abgeschlossen ist. */
  if (!state.onboardingComplete) return "/nina-einrichten";

  switch (state.careerInterviewStatus) {
    case "not_started":
      return "/app/nina";
    case "in_progress":
    case "paused":
      // Unterbrochen heißt: genau dort weiter. Das Gespräch selbst
      // weiß, bei welcher Frage es stehengeblieben ist.
      return "/app/nina";
    case "needs_review":
      return "/app/career";
    case "completed":
      // Die zuletzt besuchte Seite hat Vorrang — aber nie das
      // Interview: sonst wäre die Regel oben umsonst.
      if (state.lastActiveRoute && state.lastActiveRoute !== "/app/nina") {
        return state.lastActiveRoute;
      }
      return "/app/jobs";
  }
}

/**
 * Zählt das Interview als abgeschlossen?
 *
 * Bewusst nicht „hat genug Fragen beantwortet“: das wäre eine Schwelle,
 * die sich mit jeder Fragenliste verschiebt. Abgeschlossen ist, was ein
 * Mensch abgeschlossen hat, oder was das Mindestprofil erreicht und
 * bestätigt bekommen hat.
 */
export async function markInterviewCompleted(userId: string): Promise<void> {
  await updateWorkflowState(userId, {
    careerInterviewStatus: "completed",
    careerInterviewCompletedAt: new Date(),
    currentWorkflowStep: "profile_review",
  });
}

export async function markInterviewProgress(userId: string): Promise<void> {
  const state = await ensureWorkflowState(userId);
  // Ein laufendes Interview überschreibt kein abgeschlossenes. Wer
  // später etwas ergänzt, verliert seinen Abschluss nicht.
  if (state.careerInterviewStatus === "completed") return;
  await updateWorkflowState(userId, {
    careerInterviewStatus: "in_progress",
    currentWorkflowStep: "career_interview",
  });
}

/** Die zuletzt bearbeitete Stelle merken. Läuft bei jedem Seitenaufruf. */
export async function rememberRoute(
  userId: string,
  route: string,
  extra: { jobId?: string | null; applicationId?: string | null } = {},
): Promise<void> {
  const sauber = sanitiseRoute(route);
  if (!sauber) return;

  const db = await getDb();
  await ensureWorkflowState(userId);
  await withUser(db, userId, (tx) =>
    tx
      .update(schema.workflowStates)
      .set({
        lastActiveRoute: sauber,
        ...(extra.jobId !== undefined ? { lastActiveJobId: extra.jobId } : {}),
        ...(extra.applicationId !== undefined
          ? { lastActiveApplicationId: extra.applicationId }
          : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(schema.workflowStates.userId, userId)),
  );
}
