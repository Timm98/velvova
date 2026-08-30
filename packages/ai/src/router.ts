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
 * Die Stufen heißen nach ihrer AUFGABE, nicht poetisch. Sie hießen
 * einmal TERRA, SOL und LUNA — und genau das wurde zum Problem: in der
 * Vorgabe stand TERRA für das Gespräch und LUNA für die billige
 * Massenaufgabe, im Code war es umgekehrt. Zwei Dokumente, dieselben
 * drei Wörter, entgegengesetzte Bedeutung. Ein Name, den man nachschlagen
 * muss, ist ein Name, den irgendwann jemand falsch nachschlägt.
 *
 * Die Namen sind weiterhin keine Modellnamen: welches Modell dahinter
 * steht, ist Konfiguration. Im Fachcode steht nie ein Modellname —
 * sonst ist der Anbieterwechsel ein Umbau statt einer Einstellung.
 *
 *   FAST      Klassifizieren, extrahieren, normalisieren, verdichten.
 *             Hohe Menge, geringe Tiefe, muss billig sein.
 *             → OPENAI_MODEL_FAST
 *   DEFAULT   Das Gespräch. Tempo vor Tiefe — eine Rückfrage nach vier
 *             Sekunden ist keine Rückfrage mehr. Der Regelfall; nicht
 *             jede Nachricht braucht die teure Stufe.
 *             → OPENAI_MODEL_DEFAULT
 *   DEEP      Profilsynthese, Rollenvergleich, Bewerbungstexte,
 *             widersprüchliche Belege. Darf dauern, muss stimmen.
 *             → OPENAI_MODEL_DEEP
 *   REALTIME  Sprache. Eigener Pfad, eigene Zugangsdaten, eigene
 *             kurze Lebensdauer.
 *             → OPENAI_MODEL_REALTIME
 */

export type ModelTier = "FAST" | "DEFAULT" | "DEEP" | "REALTIME";

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
  | "voice_session"
  /*
   * Die Aufgabentypen aus der Produktvorgabe.
   *
   * Sie stehen neben den internen Namen, nicht statt ihrer: die
   * bestehenden Aufrufstellen sollen nicht umbenannt werden, nur damit
   * eine Liste passt. Wo beide dasselbe meinen, steht dieselbe Stufe.
   */
  | "conversation"
  | "career_interview"
  | "career_analysis"
  | "career_role_exploration"
  | "job_summary"
  | "job_match"
  | "job_long_term_analysis"
  | "application_strategy"
  | "document_generation"
  | "document_extraction"
  | "classification"
  | "conversation_summary"
  | "support";

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
  FAST: "fast",
  DEFAULT: "interactive",
  DEEP: "deep",
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
    tier: "DEFAULT",
    reason: "Ein Mensch wartet auf die nächste Frage.",
    timeoutMs: 20_000,
    fallback: "FAST",
  },
  interview_followup: {
    tier: "DEFAULT",
    reason: "Rückfrage im laufenden Gespräch.",
    timeoutMs: 20_000,
    fallback: "FAST",
  },
  nina_chat: {
    tier: "DEFAULT",
    reason: "Gespräch mit Werkzeugaufrufen; das Tempo trägt das Erlebnis.",
    timeoutMs: 60_000,
    fallback: "FAST",
  },

  evidence_extraction: {
    tier: "FAST",
    reason: "Aussagen aus Text herauslösen. Menge statt Tiefe.",
    timeoutMs: 30_000,
    fallback: null,
  },
  language_detection: {
    tier: "FAST",
    reason: "Einfache Klassifikation. Ein grosses Modell wäre Verschwendung.",
    timeoutMs: 10_000,
    fallback: null,
  },
  job_normalisation: {
    tier: "FAST",
    reason: "Formatangleich über viele Datensätze.",
    timeoutMs: 30_000,
    fallback: null,
  },
  requirement_extraction: {
    tier: "FAST",
    reason: "Anforderungen aus einer Anzeige lesen.",
    timeoutMs: 30_000,
    fallback: null,
  },
  review_theme_clustering: {
    tier: "FAST",
    reason: "Wiederkehrende Themen in Bewertungen bündeln.",
    timeoutMs: 45_000,
    fallback: null,
  },

  profile_synthesis: {
    tier: "DEEP",
    reason: "Aus vielen Belegen wird ein Bild. Fehler hier tragen weit.",
    timeoutMs: 120_000,
    fallback: "DEFAULT",
  },
  role_suggestion: {
    tier: "DEEP",
    reason: "Rollenvorschläge müssen begründbar sein, nicht nur plausibel.",
    timeoutMs: 90_000,
    fallback: "DEFAULT",
  },
  job_fit_explanation: {
    tier: "DEEP",
    reason: "Die Begründung wird der Person gezeigt und muss standhalten.",
    timeoutMs: 60_000,
    fallback: "DEFAULT",
  },
  career_transition_analysis: {
    tier: "DEEP",
    reason: "Ein Wechselpfad über Jahre. Der teuerste Rat im Produkt.",
    timeoutMs: 120_000,
    fallback: "DEFAULT",
  },

  cover_letter_draft: {
    tier: "DEEP",
    reason: "Der Text geht an einen Arbeitgeber. Er trägt einen Namen.",
    timeoutMs: 90_000,
    fallback: "DEFAULT",
  },
  cv_section_draft: {
    tier: "DEEP",
    reason: "Wie beim Anschreiben: das Ergebnis verlässt das Haus.",
    timeoutMs: 90_000,
    fallback: "DEFAULT",
  },
  application_claim_check: {
    tier: "FAST",
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
    fallback: "DEFAULT",
  },

  /* ── Die Aufgabentypen aus der Produktvorgabe ──────────────── */

  conversation: {
    tier: "DEFAULT",
    reason: "Der Regelfall. Ein Mensch wartet auf eine Antwort.",
    timeoutMs: 60_000,
    fallback: "FAST",
  },
  career_interview: {
    tier: "DEFAULT",
    reason: "Gespräch mit Rückfragen. Tempo trägt das Erlebnis.",
    timeoutMs: 60_000,
    fallback: "FAST",
  },
  support: {
    tier: "DEFAULT",
    reason: "Eine Frage zum Produkt. Braucht Klarheit, keine Tiefe.",
    timeoutMs: 40_000,
    fallback: "FAST",
  },
  job_summary: {
    tier: "DEFAULT",
    reason: "Eine Anzeige verständlich machen. Der Inhalt liegt vor.",
    timeoutMs: 40_000,
    fallback: "FAST",
  },

  career_analysis: {
    tier: "DEEP",
    reason: "Die abschließende Sicht auf ein Berufsleben. Fehler tragen weit.",
    timeoutMs: 120_000,
    fallback: "DEFAULT",
  },
  career_role_exploration: {
    tier: "DEEP",
    reason: "Rollen jenseits des Naheliegenden. Genau die Aufgabe, an der ein schnelles Modell das Naheliegende wiederholt.",
    timeoutMs: 120_000,
    fallback: "DEFAULT",
  },
  job_match: {
    tier: "DEEP",
    reason: "Die Begründung wird der Person gezeigt und muss standhalten.",
    timeoutMs: 90_000,
    fallback: "DEFAULT",
  },
  job_long_term_analysis: {
    tier: "DEEP",
    reason: "Was diese Stelle in fünf Jahren bedeutet. Der teuerste Rat im Produkt.",
    timeoutMs: 120_000,
    fallback: "DEFAULT",
  },
  application_strategy: {
    tier: "DEEP",
    reason: "Der Plan für eine Bewerbung, auf die jemand hofft.",
    timeoutMs: 120_000,
    fallback: "DEFAULT",
  },
  document_generation: {
    tier: "DEEP",
    reason: "Der Text verlässt das Haus und trägt einen Namen.",
    timeoutMs: 90_000,
    fallback: "DEFAULT",
  },

  document_extraction: {
    tier: "FAST",
    reason: "Angaben aus einem Dokument herauslösen. Menge statt Tiefe.",
    timeoutMs: 30_000,
    fallback: null,
  },
  classification: {
    tier: "FAST",
    reason: "Etikettieren und einsortieren. Ein grosses Modell wäre Verschwendung.",
    timeoutMs: 15_000,
    fallback: null,
  },
  conversation_summary: {
    tier: "FAST",
    reason:
      "Verdichten läuft im Hintergrund und oft. Genau die Aufgabe, bei der " +
      "die teure Stufe die Rechnung macht, ohne dass jemand den Unterschied sieht.",
    timeoutMs: 30_000,
    fallback: null,
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
