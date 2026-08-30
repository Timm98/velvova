import { eq, sql, and, isNull } from "drizzle-orm";
import { getDb, schema, withUser } from "@paycheck/db";
import { loadGate } from "@/lib/gate";
import { initialState, type WorkflowState } from "../workflow/state-machine.ts";
import { ContextIntegrityError, type NinaContextEnvelope, type ScopedContext } from "./types.ts";

/**
 * Den Kontext für einen Modellaufruf zusammenstellen.
 *
 * Reihenfolge ist Absicht: zuerst der Zustand, dann bestätigte Fakten,
 * dann Vermutungen, zuletzt der Gesprächsausschnitt. Was zuerst
 * geladen wird, ist das, was zuerst zählt.
 *
 * `authenticatedUserId` ist ein **Parameter**, kein Feld aus einem
 * Anfragekörper. Der Aufrufer muss ihn aus der Sitzung holen; es gibt
 * keinen anderen Weg, ihn zu setzen.
 */
export async function buildContextEnvelope(
  authenticatedUserId: string,
  options: {
    conversationId?: string;
    applicationId?: string | null;
    locale?: string;
    timezone?: string;
  } = {},
): Promise<NinaContextEnvelope> {
  if (!authenticatedUserId) {
    throw new ContextIntegrityError(
      "Ohne Nutzerkennung aus der Sitzung wird kein Kontext gebildet.",
    );
  }

  const db = await getDb();

  const [profile, workflow, gate] = await Promise.all([
    withUser(db, authenticatedUserId, async (tx) =>
      (
        await tx
          .select({
            id: schema.careerProfiles.id,
            userId: schema.careerProfiles.userId,
            // Die Fassung ist noch nicht als Spalte geführt. Der
            // Bestätigungszeitpunkt ist der belastbarste Ersatz: er
            // ändert sich genau dann, wenn sich das Profil ändert.
            confirmedAt: schema.careerProfiles.confirmedAt,
          })
          .from(schema.careerProfiles)
          .where(eq(schema.careerProfiles.userId, authenticatedUserId))
          .limit(1)
      )[0],
    ),
    loadWorkflowState(authenticatedUserId),
    loadGate(authenticatedUserId),
  ]);

  return {
    authenticatedUserId,
    locale: options.locale ?? "de",
    timezone: options.timezone ?? "Europe/Berlin",

    careerProfileId: profile?.id ?? null,
    careerProfileVersion: profile?.confirmedAt ? Math.floor(profile.confirmedAt.getTime() / 1000) : null,

    activeCampaignId: null,
    activeConversationId: options.conversationId ?? authenticatedUserId,
    activeApplicationId: options.applicationId ?? null,

    workflowStage: workflow.stage,
    lastCompletedAction: workflow.lastCompletedAction,
    currentAction: workflow.currentAction,
    pendingAction:
      workflow.pendingAction ??
      (gate.unlocked ? null : (gate.reason ?? null)),

    selectedJobIds: workflow.selectedJobIds,
    relevantMemoryItemIds: [],
  };
}

/**
 * Den gespeicherten Vorgangszustand laden.
 *
 * Solange Supabase nicht verbunden ist, wird er aus dem Zustand des
 * Gesprächs abgeleitet. Das ist keine Behauptung über Fortschritt: es
 * sind dieselben Ereignisse, nur an einer anderen Stelle abgelesen.
 */
export async function loadWorkflowState(userId: string): Promise<WorkflowState> {
  const db = await getDb();
  const gate = await loadGate(userId);

  const [applications, saved] = await Promise.all([
    withUser(db, userId, (tx) =>
      tx
        .select({ id: schema.applications.id, stage: schema.applications.stage })
        .from(schema.applications)
        .where(eq(schema.applications.userId, userId))
        .orderBy(sql`${schema.applications.updatedAt} desc`)
        .limit(1),
    ),
    withUser(db, userId, (tx) =>
      tx
        .select({ jobId: schema.savedJobs.jobId })
        .from(schema.savedJobs)
        .where(eq(schema.savedJobs.userId, userId)),
    ),
  ]);

  const state = initialState();
  state.selectedJobIds = saved.map((s) => s.jobId);

  const application = applications[0];

  if (application) {
    // Die Schlüssel sind exakt die Werte von `application_stage`. Ein
    // Eintrag für einen Zustand, den es nicht gibt, wäre stiller
    // toter Code — und ein fehlender Eintrag stiller Fortschrittsverlust.
    const byStage: Record<
      (typeof schema.applications.stage)["_"]["data"],
      Partial<WorkflowState>
    > = {
      saved: { stage: "JOB_REVIEW", lastCompletedAction: "Stelle gemerkt" },
      preparing: { stage: "APPLICATION_PREP", lastCompletedAction: "Bewerbung begonnen" },
      sent: { stage: "APPLICATION_TRACKING", lastCompletedAction: "Bewerbung versendet" },
      acknowledged: { stage: "APPLICATION_TRACKING", lastCompletedAction: "Eingang bestätigt" },
      interview: { stage: "INTERVIEW_COACHING", lastCompletedAction: "Zum Gespräch eingeladen" },
      offer: { stage: "OFFER_REVIEW", lastCompletedAction: "Angebot erhalten" },
      accepted: { stage: "HIRED", lastCompletedAction: "Angebot angenommen" },
      // Abgelehnt und zurückgezogen sind abgeschlossen, nicht offen:
      // Nina soll hier nicht zum Weitermachen drängen.
      rejected: { stage: "JOB_SEARCH", lastCompletedAction: "Absage erhalten" },
      withdrawn: { stage: "JOB_SEARCH", lastCompletedAction: "Bewerbung zurückgezogen" },
    };
    Object.assign(state, byStage[application.stage] ?? {});
    const abgeschlossen = ["rejected", "withdrawn", "accepted"].includes(application.stage);
    if (state.lastCompletedAction) {
      state.nextRecommendedAction = abgeschlossen
        ? "Weitere Möglichkeiten ansehen"
        : "Bewerbung fortsetzen";
      state.pendingAction = state.nextRecommendedAction;
    }
    return state;
  }

  if (gate.unlocked) {
    state.stage = "JOB_SEARCH";
    state.lastCompletedAction = "Profil bestätigt";
    state.nextRecommendedAction = "Deine besten Möglichkeiten ansehen";
    state.pendingAction = state.nextRecommendedAction;
    return state;
  }

  if (gate.hasAnySession) {
    state.stage = "CAREER_INTERVIEW";
    state.lastCompletedAction = "Gespräch begonnen";
    state.nextRecommendedAction = gate.reason;
    state.pendingAction = gate.reason;
    return state;
  }

  return state;
}

/**
 * Den Geltungsbereich für eine Aufgabe füllen.
 *
 * Hier fällt die Entscheidung, WIE VIEL das Modell sieht. Ein Gespräch
 * über eine einzelne Bewerbung braucht nicht das gesamte
 * Karriereprofil, und der vollständige Verlauf wird nie geschickt —
 * dafür gibt es die Zusammenfassung.
 */
export async function buildScopedContext(
  envelope: NinaContextEnvelope,
  options: { recentTurnLimit?: number } = {},
): Promise<ScopedContext> {
  const db = await getDb();
  const userId = envelope.authenticatedUserId;
  const limit = options.recentTurnLimit ?? 10;

  const [evidence, turns, summary] = await Promise.all([
    withUser(db, userId, (tx) =>
      tx
        .select({
          statement: schema.evidenceItems.statement,
          confirmed: schema.evidenceItems.userConfirmed,
          rejected: schema.evidenceItems.userRejected,
        })
        .from(schema.evidenceItems)
        .where(
          and(eq(schema.evidenceItems.userId, userId), isNull(schema.evidenceItems.deletedAt)),
        )
        .limit(150),
    ),
    withUser(db, userId, (tx) =>
      tx
        .select({
          role: schema.interviewTurns.role,
          content: schema.interviewTurns.content,
        })
        .from(schema.interviewTurns)
        .where(eq(schema.interviewTurns.userId, userId))
        .orderBy(sql`${schema.interviewTurns.createdAt} desc`)
        .limit(limit),
    ),
    withUser(db, userId, async (tx) =>
      (
        await tx
          .select({ data: schema.userConstraints.data })
          .from(schema.userConstraints)
          .where(eq(schema.userConstraints.userId, userId))
          .limit(1)
      )[0],
    ),
  ]);

  // Harte Bedingungen als lesbare Sätze. Das Modell soll sie nicht
  // interpretieren müssen — und schon gar nicht aufweichen.
  const constraints: string[] = [];
  const raw = (summary?.data ?? {}) as Record<string, unknown>;
  if (typeof raw.minSalaryPerYear === "number") {
    constraints.push(`Mindestgehalt ${raw.minSalaryPerYear} pro Jahr — nicht verhandelbar.`);
  }
  if (typeof raw.maxCommuteMinutes === "number") {
    constraints.push(`Höchstens ${raw.maxCommuteMinutes} Minuten Weg je Richtung.`);
  }
  if (raw.remoteRequired === true) constraints.push("Remote ist Bedingung, kein Wunsch.");

  return {
    envelope,
    confirmedFacts: evidence.filter((e) => e.confirmed && !e.rejected).map((e) => e.statement),
    openHypotheses: evidence.filter((e) => !e.confirmed && !e.rejected).map((e) => e.statement),
    hardConstraints: constraints,
    rejectedStatements: evidence.filter((e) => e.rejected).map((e) => e.statement),
    conversationSummary: null,
    recentTurns: turns
      .reverse()
      .filter((t): t is { role: "user" | "assistant"; content: string } =>
        t.role === "user" || t.role === "assistant",
      )
      .map((t) => ({ role: t.role, content: t.content })),
  };
}
