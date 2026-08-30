/**
 * Der Zustandsautomat des Vorgangs.
 *
 * Er beantwortet die eine Frage, die Nina bei jedem Login stellen
 * können muss: **wo waren wir?**
 *
 * Bewusst reine Logik ohne Datenbankzugriff. Der Zustand kommt herein,
 * der nächste Zustand geht heraus — dadurch ist der Ablauf testbar,
 * ohne eine Datenbank zu starten, und die Regeln stehen an einer Stelle
 * statt verteilt über Route Handler.
 *
 * Zwei Eigenschaften sind hier wichtiger als Eleganz:
 *
 * 1. **Idempotenz.** Dieselbe Handlung zweimal gemeldet führt nicht
 *    zwei Schritte weiter. Ein doppelt abgeschickter Klick ist der
 *    Normalfall, nicht der Ausnahmefall.
 *
 * 2. **Kein Rückschritt durch Zufall.** Der Automat geht nicht von
 *    selbst zurück. Wer zurück will, sagt das ausdrücklich.
 */

export const STAGES = [
  "ACCOUNT_SETUP",
  "CAREER_INTERVIEW",
  "PROFILE_REVIEW",
  "ROLE_DISCOVERY",
  "JOB_SEARCH",
  "JOB_REVIEW",
  "APPLICATION_PREP",
  "APPLICATION_REVIEW",
  "APPLY_REDIRECT",
  "APPLICATION_TRACKING",
  "INTERVIEW_COACHING",
  "OFFER_REVIEW",
  "HIRED",
  "CAREER_MODE",
] as const;

export type Stage = (typeof STAGES)[number];

export interface WorkflowState {
  stage: Stage;
  lastCompletedAction: string | null;
  currentAction: string | null;
  pendingAction: string | null;
  nextRecommendedAction: string | null;
  selectedJobIds: string[];
  version: number;
}

/**
 * Ereignisse, die den Vorgang bewegen.
 *
 * Sie beschreiben, was GESCHEHEN ist — nicht, wohin gesprungen werden
 * soll. Ein Ereignis „setze Stufe auf X" wäre kein Automat, sondern ein
 * Setter mit Zeremonie.
 */
export type WorkflowEvent =
  | { type: "ACCOUNT_COMPLETED" }
  | { type: "INTERVIEW_STARTED" }
  | { type: "INTERVIEW_STAGE_COMPLETED"; stageKey: string; totalRequired: number; completed: number }
  | { type: "PROFILE_CONFIRMED" }
  | { type: "ROLES_CONFIRMED"; clusterCount: number }
  | { type: "SEARCH_EXECUTED"; resultCount: number }
  | { type: "JOB_SELECTED"; jobId: string }
  | { type: "JOB_DESELECTED"; jobId: string }
  | { type: "APPLICATION_STARTED"; applicationId: string }
  | { type: "DOCUMENTS_READY" }
  | { type: "APPLICATION_APPROVED" }
  | { type: "REDIRECTED_TO_SOURCE" }
  | { type: "APPLICATION_SUBMITTED" }
  | { type: "INTERVIEW_INVITED" }
  | { type: "OFFER_RECEIVED" }
  | { type: "OFFER_ACCEPTED" }
  | { type: "CAREER_MODE_STARTED" }
  | { type: "USER_JUMPED_BACK"; stage: Stage };

export function initialState(): WorkflowState {
  return {
    stage: "ACCOUNT_SETUP",
    lastCompletedAction: null,
    currentAction: "Konto einrichten",
    pendingAction: "Sprache und Region festlegen",
    nextRecommendedAction: "Sprache und Region festlegen",
    selectedJobIds: [],
    version: 1,
  };
}

const ORDER = new Map(STAGES.map((s, i) => [s, i]));

/** Geht nie rückwärts. Der Automat verliert keinen Fortschritt. */
function advanceTo(current: Stage, target: Stage): Stage {
  return (ORDER.get(target) ?? 0) > (ORDER.get(current) ?? 0) ? target : current;
}

export function transition(state: WorkflowState, event: WorkflowEvent): WorkflowState {
  const next = (
    stage: Stage,
    lastCompletedAction: string,
    currentAction: string | null,
    nextRecommendedAction: string | null,
    extra: Partial<WorkflowState> = {},
  ): WorkflowState => ({
    ...state,
    ...extra,
    stage: advanceTo(state.stage, stage),
    lastCompletedAction,
    currentAction,
    pendingAction: nextRecommendedAction,
    nextRecommendedAction,
    version: state.version + 1,
  });

  switch (event.type) {
    case "ACCOUNT_COMPLETED":
      return next(
        "CAREER_INTERVIEW",
        "Konto eingerichtet",
        "Karrieregespräch",
        "Erzähl Nina von einer konkreten Aufgabe der letzten zwei Jahre",
      );

    case "INTERVIEW_STARTED":
      return next("CAREER_INTERVIEW", "Gespräch begonnen", "Karrieregespräch", "Gespräch fortsetzen");

    case "INTERVIEW_STAGE_COMPLETED": {
      const remaining = Math.max(0, event.totalRequired - event.completed);
      // Erst wenn alle Themen berührt sind, geht es zur Prüfung. Ein
      // Profil aus drei Antworten ist kein Profil.
      if (remaining > 0) {
        return next(
          "CAREER_INTERVIEW",
          `Thema „${event.stageKey}" abgeschlossen`,
          "Karrieregespräch",
          `Noch ${remaining} ${remaining === 1 ? "Thema" : "Themen"} bis zu deinem Profil`,
        );
      }
      return next(
        "PROFILE_REVIEW",
        "Gespräch abgeschlossen",
        "Profil prüfen",
        "Bestätige, was stimmt — nur Bestätigtes zählt",
      );
    }

    case "PROFILE_CONFIRMED":
      return next(
        "ROLE_DISCOVERY",
        "Profil bestätigt",
        "Rollen entdecken",
        "Sieh dir die vorgeschlagenen Richtungen an",
      );

    case "ROLES_CONFIRMED":
      return next(
        "JOB_SEARCH",
        `${event.clusterCount} Richtungen bestätigt`,
        "Stellen suchen",
        "Nina sucht in den freigegebenen Quellen",
      );

    case "SEARCH_EXECUTED":
      return next(
        "JOB_REVIEW",
        `${event.resultCount} Stellen geprüft`,
        "Stellen ansehen",
        event.resultCount > 0
          ? "Sieh dir die begründetsten Treffer an"
          : "Keine Treffer — Filter lockern oder Suchbegriffe anpassen",
      );

    case "JOB_SELECTED":
      // Idempotent: dieselbe Stelle zweimal markiert bleibt einmal
      // markiert. Ein doppelter Klick ist der Normalfall.
      if (state.selectedJobIds.includes(event.jobId)) return state;
      return next("JOB_REVIEW", "Stelle gemerkt", "Stellen ansehen", "Bewerbung vorbereiten", {
        selectedJobIds: [...state.selectedJobIds, event.jobId],
      });

    case "JOB_DESELECTED":
      if (!state.selectedJobIds.includes(event.jobId)) return state;
      return {
        ...state,
        selectedJobIds: state.selectedJobIds.filter((id) => id !== event.jobId),
        version: state.version + 1,
      };

    case "APPLICATION_STARTED":
      return next(
        "APPLICATION_PREP",
        "Bewerbung begonnen",
        "Unterlagen vorbereiten",
        "Prüfe, welche Anforderungen du belegen kannst",
      );

    case "DOCUMENTS_READY":
      return next(
        "APPLICATION_REVIEW",
        "Unterlagen erstellt",
        "Unterlagen prüfen",
        "Jede Aussage braucht einen Beleg — prüfe die markierten Stellen",
      );

    case "APPLICATION_APPROVED":
      return next(
        "APPLY_REDIRECT",
        "Unterlagen freigegeben",
        "Zur Originalquelle",
        "Bewirb dich auf der Originalseite; danach hier als versendet markieren",
      );

    case "REDIRECTED_TO_SOURCE":
      return next(
        "APPLY_REDIRECT",
        "Zur Originalquelle gewechselt",
        "Zur Originalquelle",
        "Hast du dich beworben? Dann hier als versendet markieren",
      );

    case "APPLICATION_SUBMITTED":
      return next(
        "APPLICATION_TRACKING",
        "Bewerbung versendet",
        "Stand verfolgen",
        "Nachfassen, wenn nach zehn Tagen keine Antwort kommt",
      );

    case "INTERVIEW_INVITED":
      return next(
        "INTERVIEW_COACHING",
        "Zum Gespräch eingeladen",
        "Gespräch vorbereiten",
        "Übe die Fragen, die diese Anzeige offenlässt",
      );

    case "OFFER_RECEIVED":
      return next("OFFER_REVIEW", "Angebot erhalten", "Angebot prüfen", "Angebot gegen deine Bedingungen prüfen");

    case "OFFER_ACCEPTED":
      return next("HIRED", "Angebot angenommen", "Einstieg", "Nach 30 Tagen zurückblicken");

    case "CAREER_MODE_STARTED":
      return next("CAREER_MODE", "Einstieg begonnen", "Karrierebegleitung", "30-Tage-Rückblick");

    case "USER_JUMPED_BACK":
      // Der einzige Weg zurück, und er kommt ausdrücklich von der
      // Person. Der Automat springt nie von selbst.
      return {
        ...state,
        stage: event.stage,
        currentAction: null,
        pendingAction: null,
        nextRecommendedAction: null,
        version: state.version + 1,
      };
  }
}

/**
 * Der Satz, mit dem Nina ein Gespräch wieder aufnimmt.
 *
 * Er entsteht aus dem gespeicherten Zustand, nicht aus einer Vermutung
 * — und behauptet deshalb nie, etwas sei erledigt, wofür kein Ereignis
 * vorliegt.
 */
export function resumeMessage(state: WorkflowState, assistantName: string): string {
  if (!state.lastCompletedAction) {
    return `Lass uns anfangen. ${state.nextRecommendedAction ?? "Wir richten dein Konto ein."}`;
  }
  // Der erste Buchstabe bleibt, wie er ist. Fast jede dieser Handlungen
  // beginnt mit einem Substantiv — "Bewerbung fortsetzen", "Profil
  // bestätigen" — und kleingeschrieben wäre das schlicht falsches
  // Deutsch, in einem Satz, den die Person als erstes zu lesen bekommt.
  const next = state.nextRecommendedAction
    ? ` Offen ist: ${state.nextRecommendedAction}.`
    : "";
  return `Zuletzt: ${state.lastCompletedAction}.${next} Möchtest du dort weitermachen? — ${assistantName}`;
}
