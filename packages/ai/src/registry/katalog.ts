import type { AiTask } from "../router.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Der Modellkatalog — die eine Stelle, an der Modelle stehen
 * ══════════════════════════════════════════════════════════════════
 *
 * Für den Menschen vor dem Bildschirm gibt es nur Monday. OpenAI,
 * Anthropic und Google sind Zulieferer. Damit das mehr ist als eine
 * Behauptung im Marketingtext, darf kein Anbietername in der
 * Anwendung stehen — er steht hier, und nur hier.
 *
 * ── Warum eine Datei und nicht eine Tabelle ─────────────────────
 *
 * Weil ein Modell kein Datensatz ist, den Nutzer anlegen, sondern
 * eine Entscheidung, die jemand trifft und die überprüfbar sein
 * muss. Eine Zeile in dieser Datei geht durch dieselbe Durchsicht wie
 * jede andere Änderung; eine Zeile in einer Tabelle geht durch keine.
 *
 * Der Betriebszustand — Schlüssel da, freigegeben, erreichbar —
 * gehört dagegen nicht hierher. Er steht in der Umgebung und wird
 * geprüft, nicht geschrieben. Siehe `registry.ts`.
 *
 * ── Was die Zahlen unter `eignung` sind, und was nicht ──────────
 *
 * Sie sind **Starthypothesen**. Niemand hat gemessen, dass ein Modell
 * Bewerbungen besser schreibt als ein anderes; die Werte kommen aus
 * den Fähigkeitsbeschreibungen der Anbieter und aus der Art der
 * Aufgabe. Deshalb heisst das Feld `eignung` und nicht `qualitaet`.
 *
 * Sobald `eval/` echte Ergebnisse liefert, gewinnen die gemessenen
 * Werte. Bis dahin darf nirgends stehen, ein Modell sei „das beste“ —
 * es ist das, was diese Tabelle für diese Aufgabe vorschlägt.
 */

/** Die drei Zulieferer. Der Nutzer sieht sie nur in der Modellauswahl. */
export type Anbieter = "openai" | "anthropic" | "google";

/**
 * Fähigkeiten sind Ausschlusskriterien, keine Vorlieben.
 *
 * Wer ein PDF anhängt, braucht ein Modell, das PDFs liest. Ein Modell
 * ohne diese Fähigkeit wird nicht schlechter bewertet, sondern fällt
 * aus der Auswahl — das ist der Unterschied zwischen „ungeeignet" und
 * „unmöglich".
 */
export type Faehigkeit =
  | "reasoning"
  | "writing"
  | "documentAnalysis"
  | "vision"
  | "structuredOutput"
  | "toolCalling"
  | "longContext"
  | "fastClassification";

export type Kostenklasse = "guenstig" | "mittel" | "teuer";
export type Tempoklasse = "schnell" | "mittel" | "langsam";

/**
 * Der Lebensweg eines Modells.
 *
 * `vorschau` ist der Grund, warum es diese Achse überhaupt gibt: Ein
 * Preview-Modell darf man ausprobieren und nicht produktiv einsetzen,
 * und dieser Unterschied verschwindet, sobald er nur im Namen steht.
 */
export type Lebenszyklus = "stabil" | "vorschau" | "abgekuendigt";

export interface Modelldefinition {
  /**
   * Der Name, unter dem Velvova dieses Modell führt.
   *
   * Bewusst nicht die API-Kennung: Die ändert sich, wenn ein Anbieter
   * eine datierte Fassung nachschiebt, und dann zeigt jede
   * gespeicherte Nutzerauswahl ins Leere.
   */
  internId: string;
  anbieter: Anbieter;
  /** Was tatsächlich an die API geht. */
  apiModellId: string;
  /** Was in der Auswahl steht. */
  anzeigename: string;
  /** Ein Satz, der sagt, wofür man es nimmt — keine Werbung. */
  beschreibung: string;
  lebenszyklus: Lebenszyklus;

  faehigkeiten: Readonly<Partial<Record<Faehigkeit, true>>>;

  /**
   * Startvermutung je Aufgabe, 0 bis 1. Fehlt ein Eintrag, gilt 0,5 —
   * „keine Meinung“, nicht „ungeeignet“.
   */
  eignung: Readonly<Partial<Record<AiTask, number>>>;

  kostenklasse: Kostenklasse;
  tempoklasse: Tempoklasse;
  /** Tokens. `null`, solange niemand nachgesehen hat. */
  maxKontext: number | null;
  eingaben: readonly ("text" | "bild" | "pdf" | "audio")[];
  /** Worauf ausgewichen werden darf. Interne Kennungen, keine API-Namen. */
  ersatz: readonly string[];
}

/**
 * ── Der Katalog ─────────────────────────────────────────────────
 *
 * Jeder Eintrag ist ein Kandidat, kein freigegebenes Modell. Ob eines
 * angeboten werden darf, entscheiden Schlüssel, Freigabe und ein
 * echter Testaufruf — nicht seine Anwesenheit in dieser Liste.
 *
 * ── Was geprüft ist und was nicht ──────────────────────────────
 *
 * Am 9. September 2026 gegen `GET /v1/models` des Produktionskontos
 * geprüft (`scripts/modell-diagnose.mjs`): 124 Modelle sichtbar,
 * darunter `gpt-6-astra`, `gpt-5` und `gpt-5-mini` — alle drei
 * OpenAI-Einträge dieses Katalogs.
 *
 * Die Anthropic- und Google-Kennungen stammen aus der
 * Anbieterdokumentation und sind NICHT geprüft: Für Anthropic lag kein
 * Schlüssel vor, für Google keiner und kein Adapter mit echtem Aufruf.
 *
 * Und auch die geprüften sind nur GELISTET. Dass ein Modell in der
 * Liste steht, heisst nicht, dass ein Aufruf mit Werkzeugen,
 * strukturierter Ausgabe und unserer Frist durchgeht. Deshalb steht
 * `Modellzustand.verfuegbarkeit` weiterhin auf `ungeprueft`, und die
 * Freigabe bleibt eine zweite, eigene Tür.
 */
export const KATALOG: readonly Modelldefinition[] = [
  /* ── OpenAI ─────────────────────────────────────────────────── */
  {
    internId: "openai-spitze",
    anbieter: "openai",
    apiModellId: "gpt-6-astra",
    anzeigename: "GPT-6 Astra",
    beschreibung: "Für lange Abwägungen und mehrstufige Werkzeugabläufe.",
    lebenszyklus: "stabil",
    faehigkeiten: {
      reasoning: true, writing: true, documentAnalysis: true, vision: true,
      structuredOutput: true, toolCalling: true, longContext: true,
    },
    eignung: {
      career_analysis: 0.9, career_transition_analysis: 0.9,
      application_strategy: 0.85, nina_chat: 0.8, conversation: 0.8,
      job_long_term_analysis: 0.85, role_suggestion: 0.8,
    },
    kostenklasse: "teuer", tempoklasse: "mittel", maxKontext: null,
    eingaben: ["text", "bild", "pdf"],
    ersatz: ["openai-arbeit"],
  },
  {
    internId: "openai-arbeit",
    anbieter: "openai",
    apiModellId: "gpt-5",
    anzeigename: "GPT-5",
    beschreibung: "Der Allrounder für den Alltag im Gespräch.",
    lebenszyklus: "stabil",
    faehigkeiten: {
      reasoning: true, writing: true, documentAnalysis: true, vision: true,
      structuredOutput: true, toolCalling: true,
    },
    eignung: { nina_chat: 0.75, conversation: 0.75, career_analysis: 0.7, job_match: 0.7 },
    kostenklasse: "mittel", tempoklasse: "mittel", maxKontext: null,
    eingaben: ["text", "bild"],
    ersatz: ["openai-schnell"],
  },
  {
    internId: "openai-schnell",
    anbieter: "openai",
    apiModellId: "gpt-5-mini",
    anzeigename: "GPT-5 mini",
    beschreibung: "Schnell und günstig — für Einordnen und Zusammenfassen.",
    lebenszyklus: "stabil",
    faehigkeiten: {
      writing: true, structuredOutput: true, toolCalling: true, fastClassification: true,
    },
    eignung: {
      classification: 0.85, language_detection: 0.85, conversation_summary: 0.8,
      job_normalisation: 0.8, job_summary: 0.75, document_extraction: 0.7,
    },
    kostenklasse: "guenstig", tempoklasse: "schnell", maxKontext: null,
    eingaben: ["text"],
    ersatz: [],
  },

  /* ── Anthropic ──────────────────────────────────────────────── */
  {
    internId: "anthropic-spitze",
    anbieter: "anthropic",
    apiModellId: "claude-fable-5-1",
    anzeigename: "Claude Fable 5.1",
    beschreibung: "Für Unterlagen, Anschreiben und genaues Deutsch.",
    lebenszyklus: "stabil",
    faehigkeiten: {
      reasoning: true, writing: true, documentAnalysis: true, vision: true,
      structuredOutput: true, toolCalling: true, longContext: true,
    },
    eignung: {
      cover_letter_draft: 0.9, cv_section_draft: 0.9, document_generation: 0.88,
      application_claim_check: 0.85, document_extraction: 0.8,
      evidence_extraction: 0.8, career_analysis: 0.85,
    },
    kostenklasse: "teuer", tempoklasse: "mittel", maxKontext: null,
    eingaben: ["text", "bild", "pdf"],
    ersatz: ["anthropic-arbeit"],
  },
  {
    internId: "anthropic-arbeit",
    anbieter: "anthropic",
    apiModellId: "claude-opus-5",
    anzeigename: "Claude Opus 5",
    beschreibung: "Der sparsamere Weg für dieselbe Art Arbeit.",
    lebenszyklus: "stabil",
    faehigkeiten: {
      reasoning: true, writing: true, documentAnalysis: true, vision: true,
      structuredOutput: true, toolCalling: true, longContext: true,
    },
    eignung: {
      cover_letter_draft: 0.8, cv_section_draft: 0.8, nina_chat: 0.75,
      conversation: 0.75, document_generation: 0.78,
    },
    kostenklasse: "mittel", tempoklasse: "mittel", maxKontext: null,
    eingaben: ["text", "bild", "pdf"],
    ersatz: [],
  },

  /* ── Google ─────────────────────────────────────────────────── */
  {
    internId: "google-flash",
    anbieter: "google",
    apiModellId: "gemini-3.8-flash",
    anzeigename: "Gemini 3.8 Flash",
    beschreibung: "Für gemischte Eingaben und grosse Mengen Struktur.",
    lebenszyklus: "stabil",
    faehigkeiten: {
      writing: true, documentAnalysis: true, vision: true, structuredOutput: true,
      toolCalling: true, longContext: true, fastClassification: true,
    },
    eignung: {
      document_extraction: 0.85, requirement_extraction: 0.85,
      job_normalisation: 0.85, classification: 0.8, job_summary: 0.8,
    },
    kostenklasse: "guenstig", tempoklasse: "schnell", maxKontext: null,
    eingaben: ["text", "bild", "pdf", "audio"],
    ersatz: ["openai-schnell"],
  },
  {
    internId: "google-pro-vorschau",
    anbieter: "google",
    apiModellId: "gemini-3.1-pro-preview",
    anzeigename: "Gemini 3.1 Pro",
    beschreibung: "Vorschau. Nicht für den Regelbetrieb.",
    /*
     * `vorschau` ist hier kein Etikett, sondern eine Sperre: Die
     * Registry lässt Vorschaumodelle nur zu, wenn jemand das
     * ausdrücklich eingeschaltet hat.
     */
    lebenszyklus: "vorschau",
    faehigkeiten: {
      reasoning: true, writing: true, documentAnalysis: true, vision: true,
      structuredOutput: true, toolCalling: true, longContext: true,
    },
    eignung: { career_analysis: 0.8, document_extraction: 0.8 },
    kostenklasse: "mittel", tempoklasse: "mittel", maxKontext: null,
    eingaben: ["text", "bild", "pdf", "audio"],
    ersatz: ["google-flash"],
  },
];

/** Fehlt eine Eignung, gilt „keine Meinung“ — nicht „ungeeignet“. */
export const EIGNUNG_UNBEKANNT = 0.5;

export function eignungFuer(m: Modelldefinition, task: AiTask): number {
  return m.eignung[task] ?? EIGNUNG_UNBEKANNT;
}
