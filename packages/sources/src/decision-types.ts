/**
 * Die Begriffe, mit denen über Quellen entschieden wird.
 *
 * Der wichtigste Satz dieses Moduls steht nicht im Code, sondern gilt
 * für ihn: **Umformulieren ist keine Rechtsgrundlage.** Eine
 * Stellenanzeige, die nicht abgerufen werden darf, darf auch nicht
 * abgerufen und dann anders formuliert werden. Deshalb entscheidet die
 * Engine über den ZUGRIFF, nicht über die Darstellung.
 */

/** Woraus sich die Erlaubnis ableitet. Genau eine je Quelle. */
export type LegalBasis =
  | "commercial_contract"
  | "official_api_terms"
  | "employer_authorization"
  | "open_license"
  | "government_partnership"
  | "user_private_import"
  | "link_only";

/** Wie technisch zugegriffen wird. */
export type AccessMode =
  | "api"
  | "feed"
  | "partner"
  | "employer_authorized"
  | "open_license"
  | "public_jsonld_authorized"
  | "user_private_import"
  | "discovery_only"
  | "link_only"
  | "blocked";

/**
 * Was mit den Daten geschehen darf.
 *
 * Bewusst feingliedrig: „durchsuchen" und „öffentlich anzeigen" sind
 * verschiedene Dinge, und eine Quelle kann das eine erlauben und das
 * andere nicht. Eine einzige Wahrheitsvariable `enabled` würde genau
 * diesen Unterschied verschlucken.
 */
export type SourceOperation =
  | "Search"
  | "FetchDetails"
  | "Cache"
  | "PublicDisplay"
  | "Summarize"
  | "Embed"
  | "Rank"
  | "Export"
  | "NativeApply";

export const ALL_OPERATIONS: SourceOperation[] = [
  "Search",
  "FetchDetails",
  "Cache",
  "PublicDisplay",
  "Summarize",
  "Embed",
  "Rank",
  "Export",
  "NativeApply",
];

export type PolicyDecision =
  | "approved"
  | "link_only"
  | "private_import"
  | "blocked"
  | "pending_review";

export interface SourceDecision {
  sourceId: string | null;
  decision: PolicyDecision;
  allowedOperations: SourceOperation[];
  allowedFields: string[];
  attribution: string | null;
  maxCacheHours: number | null;
  /** Maschinenlesbarer Grund. Landet im Protokoll und in der Oberfläche. */
  reasonCode: string;
  /** Ein Satz, den man einer Person zeigen kann. */
  reason: string;
}

/**
 * Wie ein einzelnes Feld zustande kam.
 *
 * Diese Unterscheidung ist der Kern der Provenienz: „steht so in der
 * Anzeige" und „hat Monday daraus geschlossen" dürfen niemals gleich
 * aussehen.
 */
export type TransformType =
  | "verbatim_allowed"
  | "normalized"
  | "ai_summary"
  | "inferred"
  | "unknown";

export class SourcePolicyError extends Error {
  readonly reasonCode: string;
  readonly decision: PolicyDecision;

  constructor(message: string, reasonCode: string, decision: PolicyDecision) {
    super(message);
    this.name = "SourcePolicyError";
    this.reasonCode = reasonCode;
    this.decision = decision;
  }
}
