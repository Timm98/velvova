import { z } from "zod";

/**
 * Provider-Abstraktion.
 *
 * Kein Modellname und kein Anbieter steht im Fachcode. Wer den Provider
 * wechselt, ändert Konfiguration - nicht Domänenlogik. Das ist kein
 * Selbstzweck: für besonders schutzbedürftige Verarbeitung muss ein
 * selbst betriebener Pfad möglich bleiben, ohne das Produkt umzubauen.
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
  /**
   * Welches Leistungsniveau. Die Zuordnung zu Modellen ist reine
   * Konfiguration — im Fachcode steht nie ein Modellname.
   *
   *   interactive  Gespräch, Rückfragen. Tempo zählt.
   *   deep         Profilsynthese, Rollenvergleich, Jobanalyse.
   *   fast         Klassifikation, Extraktion, Normalisierung.
   */
  tier?: "interactive" | "deep" | "fast";
  /**
   * Wie lange dieser eine Aufruf dauern darf.
   *
   * Ohne Angabe gilt der Wert der Stufe. Ein Stapelaufruf, der fünf
   * Kandidaten in einem Durchgang beurteilt, ist auch mit einem
   * schnellen Modell eine grosse Aufgabe — die Stufe sagt nichts
   * darüber, wie viel zu lesen ist.
   */
  timeoutMs?: number;
  /**
   * Ein bestimmtes Modell statt des Stufenmodells.
   *
   * ── Warum es diese Ausnahme gibt ────────────────────────────
   *
   * Für die zweite Meinung. Sie läuft mit dem Ultra-Modell, und der
   * Anbieter kennt keine Ultra-Stufe — er kennt `fast`, `interactive`
   * und `deep`.
   *
   * Es ist ausdrücklich eine Ausnahme: Wer hier einen Namen einträgt,
   * umgeht die Stufenzuordnung. Genau eine Stelle im Projekt tut das,
   * und sie steht in `tiefeAnalyse`.
   */
  modell?: string;
  signal?: AbortSignal;
}

export interface StructuredOptions<T> extends ChatOptions {
  schema: z.ZodType<T>;
  schemaName: string;
}

export interface AiUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  model: string;
  provider: string;
  latencyMs: number;
}

export interface StructuredResult<T> {
  data: T;
  usage: AiUsage;
  /** Kurze, nachvollziehbare Begründung für Menschen. Ausdrücklich
   *  kein gespeicherter innerer Gedankengang des Modells. */
  rationale: string | null;
}

export interface TranscriptChunk {
  text: string;
  isFinal: boolean;
}

/**
 * Ein Ereignis aus einem laufenden Gespräch.
 *
 * Der Werkzeugaufruf ist ein eigener Ereignistyp, damit die Oberfläche
 * zeigen kann, was gerade geschieht — „Profil wird aktualisiert“,
 * „Stellen werden durchsucht“. Ein Ladebalken ohne Aussage lässt jede
 * Wartezeit doppelt so lang wirken.
 */
export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; input: unknown }
  | { type: "done"; usage: AiUsage }
  | { type: "error"; message: string };

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema, aus dem Zod-Schema erzeugt. */
  parameters: Record<string, unknown>;
}

export interface ConversationOptions extends ChatOptions {
  tools?: ToolDefinition[];
  /**
   * Ergebnisse bereits ausgeführter Werkzeuge aus derselben Runde.
   *
   * Die `arguments` gehören dazu, auch wenn sie nach der Ausführung
   * redundant wirken: die Responses-API verlangt den ursprünglichen
   * Aufruf UND sein Ergebnis als Paar. Wer nur das Ergebnis schickt,
   * bekommt einen Fehler über einen Aufruf, den es angeblich nie gab.
   */
  toolResults?: { id: string; name: string; arguments?: unknown; output: unknown }[];
}

/**
 * Alle Fähigkeiten, die das Produkt von einem Anbieter braucht.
 * Nicht unterstützte Fähigkeiten werfen einen klaren Fehler, statt
 * stillschweigend etwas anderes zu tun.
 */
export interface AiProvider {
  readonly name: string;
  /** true, wenn ausschließlich lokal und ohne Netzzugriff gearbeitet wird. */
  readonly isLocal: boolean;

  chatStream(options: ChatOptions): AsyncIterable<string>;
  /**
   * Gespräch mit Werkzeugen. Liefert Text und Werkzeugaufrufe als
   * Ereignisstrom; ausgeführt wird ausschließlich serverseitig.
   */
  streamConversation(options: ConversationOptions): AsyncIterable<StreamEvent>;
  structuredGenerate<T>(options: StructuredOptions<T>): Promise<StructuredResult<T>>;
  embed(texts: string[]): Promise<number[][]>;
  transcribe(audio: ArrayBuffer, locale: string): AsyncIterable<TranscriptChunk>;
  synthesize(text: string, locale: string): Promise<ArrayBuffer>;
  realtimeSession?(): Promise<{ close: () => Promise<void> }>;
}

export class AiCapabilityError extends Error {
  constructor(provider: string, capability: string) {
    super(
      `Der Anbieter "${provider}" unterstützt "${capability}" nicht. ` +
        `Konfiguriere einen passenden Anbieter oder nutze den Textweg.`,
    );
    this.name = "AiCapabilityError";
  }
}

export class AiBudgetError extends Error {
  constructor(spentEur: number, budgetEur: number) {
    super(`Das Monatsbudget ist erreicht (${spentEur} von ${budgetEur} EUR). Der Lauf wurde nicht ausgeführt.`);
    this.name = "AiBudgetError";
  }
}
