import type { Stage } from "../workflow/state-machine.ts";

/**
 * Der Kontext-Umschlag.
 *
 * Genau das, und nur das, was ein Modellaufruf über die Person wissen
 * muss. Kein Gesprächsverlauf, kein Lebenslauf, keine Datenbank —
 * Kennungen und Zustand.
 *
 * Die wichtigste Zeile ist die erste: `authenticatedUserId` kommt
 * **ausschließlich aus der Serversitzung**. Sie steht in keinem
 * Werkzeugschema, in keinem Anfragekörper und in keinem Prompt-Feld,
 * das ein Gespräch beeinflussen könnte. Ein manipulierter Verlauf kann
 * keine fremde Kennung unterschieben, weil es keinen Weg gibt, über den
 * sie hereinkäme.
 */
export interface NinaContextEnvelope {
  authenticatedUserId: string;
  locale: string;
  timezone: string;

  careerProfileId: string | null;
  careerProfileVersion: number | null;

  activeCampaignId: string | null;
  activeConversationId: string;
  activeApplicationId: string | null;

  workflowStage: Stage;
  lastCompletedAction: string | null;
  currentAction: string | null;
  pendingAction: string | null;

  selectedJobIds: string[];
  /** Nur Kennungen. Die Inhalte werden separat und gefiltert geladen. */
  relevantMemoryItemIds: string[];
}

/**
 * Was tatsächlich an das Modell geht.
 *
 * Getrennt vom Umschlag, weil hier eine zweite Entscheidung fällt:
 * welcher Geltungsbereich reicht für diese Aufgabe? Ein Gespräch über
 * eine einzelne Bewerbung braucht nicht das gesamte Karriereprofil.
 */
export interface ScopedContext {
  envelope: NinaContextEnvelope;
  confirmedFacts: string[];
  openHypotheses: string[];
  hardConstraints: string[];
  rejectedStatements: string[];
  conversationSummary: string | null;
  recentTurns: { role: "user" | "assistant"; content: string }[];
}

export class ContextIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContextIntegrityError";
  }
}
