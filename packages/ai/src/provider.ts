import { z } from "zod";

/**
 * Provider-Abstraktion.
 *
 * Kein Modellname und kein Anbieter steht im Fachcode. Wer den Provider
 * wechselt, aendert Konfiguration - nicht Domaenenlogik. Das ist kein
 * Selbstzweck: fuer besonders schutzbeduerftige Verarbeitung muss ein
 * selbst betriebener Pfad moeglich bleiben, ohne das Produkt umzubauen.
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
  /** Welches Leistungsniveau. Die Zuordnung zu Modellen ist Konfiguration. */
  tier?: "strong" | "fast";
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
  /** Kurze, nachvollziehbare Begruendung fuer Menschen. Ausdruecklich
   *  kein gespeicherter innerer Gedankengang des Modells. */
  rationale: string | null;
}

export interface TranscriptChunk {
  text: string;
  isFinal: boolean;
}

/**
 * Alle Faehigkeiten, die das Produkt von einem Anbieter braucht.
 * Nicht unterstuetzte Faehigkeiten werfen einen klaren Fehler, statt
 * stillschweigend etwas anderes zu tun.
 */
export interface AiProvider {
  readonly name: string;
  /** true, wenn ausschliesslich lokal und ohne Netzzugriff gearbeitet wird. */
  readonly isLocal: boolean;

  chatStream(options: ChatOptions): AsyncIterable<string>;
  structuredGenerate<T>(options: StructuredOptions<T>): Promise<StructuredResult<T>>;
  embed(texts: string[]): Promise<number[][]>;
  transcribe(audio: ArrayBuffer, locale: string): AsyncIterable<TranscriptChunk>;
  synthesize(text: string, locale: string): Promise<ArrayBuffer>;
  realtimeSession?(): Promise<{ close: () => Promise<void> }>;
}

export class AiCapabilityError extends Error {
  constructor(provider: string, capability: string) {
    super(
      `Der Anbieter "${provider}" unterstuetzt "${capability}" nicht. ` +
        `Konfiguriere einen passenden Anbieter oder nutze den Textweg.`,
    );
    this.name = "AiCapabilityError";
  }
}

export class AiBudgetError extends Error {
  constructor(spentEur: number, budgetEur: number) {
    super(`Das Monatsbudget ist erreicht (${spentEur} von ${budgetEur} EUR). Der Lauf wurde nicht ausgefuehrt.`);
    this.name = "AiBudgetError";
  }
}
