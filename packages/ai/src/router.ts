import type { ChatOptions } from "./provider.ts";

/**
 * Der Modell-Router.
 *
 * Bisher hat jede Aufrufstelle ihre Leistungsstufe selbst gewählt. Das
 * geht so lange gut, wie es fünf Aufrufstellen gibt. Danach driftet es:
 * dieselbe Aufgabe läuft an einer Stelle auf dem teuren Modell, an der
 * anderen auf dem schnellen, und niemand kann sagen, warum.
 *
 * Hier steht die Zuordnung genau einmal. Eine Aufgabe kommt herein, eine
 * Stufe geht heraus, und die Begründung steht daneben — nicht als
 * Kommentar, sondern als Feld, das mitprotokolliert wird.
 *
 * §12 nennt die Stufen bei Namen. Die Namen sind keine Modellnamen: sie
 * beschreiben ein Verhalten, und welches Modell dahinter steht, ist
 * Konfiguration. Im Fachcode steht nie ein Modellname — sonst ist der
 * Anbieterwechsel ein Umbau statt einer Einstellung.
 *
 *   TERRA     Boden. Klassifizieren, extrahieren, normalisieren.
 *             Hohe Menge, geringe Tiefe, muss billig sein.
 *   SOL       Tageslicht. Das Gespräch. Tempo vor Tiefe — eine
 *             Rückfrage nach vier Sekunden ist keine Rückfrage mehr.
 *   LUNA      Nachtarbeit. Profilsynthese, Rollenvergleich,
 *             Bewerbungstexte. Darf dauern, muss stimmen.
 *   REALTIME  Sprache. Eigener Pfad, eigene Zugangsdaten, eigene
 *             kurze Lebensdauer.
 */

export type ModelTier = "TERRA" | "SOL" | "LUNA" | "REALTIME";

/** Die Aufgaben, die im Produkt tatsächlich vorkommen. */
export type AiTask =
  // Gespräch
  | "interview_turn"
  | "interview_followup"
  | "nina_chat"
  // Verstehen
  | "evidence_extraction"
  | "language_detection"
  | "job_normalisation"
  | "requirement_extraction"
  | "review_theme_clustering"
  // Urteilen
  | "profile_synthesis"
  | "role_suggestion"
  | "job_fit_explanation"
  | "career_transition_analysis"
  // Schreiben
  | "cover_letter_draft"
  | "cv_section_draft"
  | "application_claim_check"
  // Sprache
  | "voice_session";

export interface RoutingDecision {
  task: AiTask;
  tier: ModelTier;
  /** Die Stufe, die der Provider versteht. */
  providerTier: NonNullable<ChatOptions["tier"]>;
  /** Warum diese Stufe. Wird mitprotokolliert, nicht nur gedacht. */
  reason: string;
  /** Ab hier lohnt sich Warten nicht mehr — der Aufruf wird abgebrochen. */
  timeoutMs: number;
  /** Worauf ausgewichen wird, wenn die Stufe nicht verfügbar ist. */
  fallback: ModelTier | null;
}

const PROVIDER_TIER: Record<ModelTier, NonNullable<ChatOptions["tier"]>> = {
  TERRA: "fast",
  SOL: "interactive",
  LUNA: "deep",
  // Sprache läuft über einen eigenen Pfad. Fällt der aus, ist die
  // Textstufe der ehrliche Rückfall — nicht ein stiller Abbruch.
  REALTIME: "interactive",
};

interface Regel {
  tier: ModelTier;
  reason: string;
  timeoutMs: number;
  fallback: ModelTier | null;
}

const ROUTEN: Record<AiTask, Regel> = {
  interview_turn: {
    tier: "SOL",
    reason: "Ein Mensch wartet auf die nächste Frage.",
    timeoutMs: 20_000,
    fallback: "TERRA",
  },
  interview_followup: {
    tier: "SOL",
    reason: "Rückfrage im laufenden Gespräch.",
    timeoutMs: 20_000,
    fallback: "TERRA",
  },
  nina_chat: {
    tier: "SOL",
    reason: "Gespräch mit Werkzeugaufrufen; das Tempo trägt das Erlebnis.",
    timeoutMs: 60_000,
    fallback: "TERRA",
  },

  evidence_extraction: {
    tier: "TERRA",
    reason: "Aussagen aus Text herauslösen. Menge statt Tiefe.",
    timeoutMs: 30_000,
    fallback: null,
  },
  language_detection: {
    tier: "TERRA",
    reason: "Einfache Klassifikation. Ein grosses Modell wäre Verschwendung.",
    timeoutMs: 10_000,
    fallback: null,
  },
  job_normalisation: {
    tier: "TERRA",
    reason: "Formatangleich über viele Datensätze.",
    timeoutMs: 30_000,
    fallback: null,
  },
  requirement_extraction: {
    tier: "TERRA",
    reason: "Anforderungen aus einer Anzeige lesen.",
    timeoutMs: 30_000,
    fallback: null,
  },
  review_theme_clustering: {
    tier: "TERRA",
    reason: "Wiederkehrende Themen in Bewertungen bündeln.",
    timeoutMs: 45_000,
    fallback: null,
  },

  profile_synthesis: {
    tier: "LUNA",
    reason: "Aus vielen Belegen wird ein Bild. Fehler hier tragen weit.",
    timeoutMs: 120_000,
    fallback: "SOL",
  },
  role_suggestion: {
    tier: "LUNA",
    reason: "Rollenvorschläge müssen begründbar sein, nicht nur plausibel.",
    timeoutMs: 90_000,
    fallback: "SOL",
  },
  job_fit_explanation: {
    tier: "LUNA",
    reason: "Die Begründung wird der Person gezeigt und muss standhalten.",
    timeoutMs: 60_000,
    fallback: "SOL",
  },
  career_transition_analysis: {
    tier: "LUNA",
    reason: "Ein Wechselpfad über Jahre. Der teuerste Rat im Produkt.",
    timeoutMs: 120_000,
    fallback: "SOL",
  },

  cover_letter_draft: {
    tier: "LUNA",
    reason: "Der Text geht an einen Arbeitgeber. Er trägt einen Namen.",
    timeoutMs: 90_000,
    fallback: "SOL",
  },
  cv_section_draft: {
    tier: "LUNA",
    reason: "Wie beim Anschreiben: das Ergebnis verlässt das Haus.",
    timeoutMs: 90_000,
    fallback: "SOL",
  },
  application_claim_check: {
    tier: "TERRA",
    reason:
      "Abgleich Satz gegen Beleg. Die eigentliche Prüfung ist regelbasiert; " +
      "das Modell schlägt nur eine vorsichtigere Formulierung vor.",
    timeoutMs: 30_000,
    fallback: null,
  },

  voice_session: {
    tier: "REALTIME",
    reason: "Sprache in beide Richtungen, eigener Pfad und eigene Zugangsdaten.",
    timeoutMs: 15_000,
    fallback: "SOL",
  },
};

/**
 * Die Entscheidung für eine Aufgabe.
 *
 * Bewusst ohne Ausweichmöglichkeit: es gibt kein Argument, mit dem eine
 * Aufrufstelle die Stufe überschreiben kann. Genau diese Möglichkeit
 * hätte die Zuordnung wieder über das Projekt verteilt.
 */
export function route(task: AiTask): RoutingDecision {
  const regel = ROUTEN[task];
  return {
    task,
    tier: regel.tier,
    providerTier: PROVIDER_TIER[regel.tier],
    reason: regel.reason,
    timeoutMs: regel.timeoutMs,
    fallback: regel.fallback,
  };
}

/**
 * Nach einem Fehlschlag: dieselbe Aufgabe eine Stufe tiefer.
 *
 * Gibt null zurück, wenn es keinen Rückfall gibt. Dann ist Scheitern
 * die richtige Antwort — eine Profilsynthese auf dem schnellen Modell
 * wäre kein Ersatz, sondern ein anderes, schlechteres Ergebnis, das
 * niemand als solches erkennen könnte.
 */
export function fallbackRoute(decision: RoutingDecision): RoutingDecision | null {
  if (!decision.fallback) return null;
  return {
    ...decision,
    tier: decision.fallback,
    providerTier: PROVIDER_TIER[decision.fallback],
    reason: `${decision.reason} — Rückfall von ${decision.tier} nach ${decision.fallback}.`,
  };
}

/** Alle Aufgaben. Für Dokumentation und Prüfungen. */
export const ALL_TASKS = Object.keys(ROUTEN) as AiTask[];
