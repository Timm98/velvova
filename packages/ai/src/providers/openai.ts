import OpenAI from "openai";
import { zodToJsonSchema } from "../jsonSchema.ts";
import {
  AiCapabilityError,
  type AiProvider,
  type ChatOptions,
  type StructuredOptions,
  type StructuredResult,
  type TranscriptChunk,
} from "../provider.ts";

/**
 * OpenAI über die Responses-API.
 *
 * Drei Entscheidungen, die hier bewusst getroffen sind:
 *
 * 1. Strukturierte Ausgaben laufen über `text.format` mit
 *    `type: "json_schema"` und `strict: true`. Freien Text zu parsen und
 *    zu hoffen wäre der Anfang von stillen Fehlern; hier muss das Modell
 *    dem Schema folgen — und die Antwort wird danach trotzdem noch
 *    einmal gegen dasselbe Zod-Schema geprüft, bevor sie irgendwo
 *    landet.
 *
 * 2. Der Modellname ist reine Konfiguration. Hat das Konto keinen
 *    Zugriff darauf, erscheint eine verständliche Konfigurationsmeldung
 *    — und niemals eine erfundene Antwort, die so aussieht, als hätte
 *    ein Modell gearbeitet.
 *
 * 3. Wiederholungen mit wachsendem Abstand, aber nur bei Fehlern, die
 *    sich wiederholen zu lassen lohnt. Ein 400 wird nicht besser, wenn
 *    man ihn dreimal schickt.
 */

export interface OpenAiOptions {
  apiKey: string;
  /** Das Hauptmodell. Kommt aus OPENAI_PRIMARY_MODEL. */
  modelInteractive: string;
  modelDeep: string;
  /** Das schnellere Modell für einfache Schritte. */
  modelFast: string;
  modelEmbed: string;
  maxTokens: number;
  timeoutMs: number;
  baseUrl?: string;
  transcribeModel?: string;
  speechModel?: string;
  speechVoice?: string;
}

/** Fehler, die sich zu wiederholen lohnt. Alles andere nicht. */
function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number }).status;
  if (status === undefined) return true; // Netzabbruch
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export class OpenAiConfigurationError extends Error {
  readonly model: string;

  constructor(model: string, detail: string) {
    super(
      `Das Modell "${model}" ist mit diesem Zugang nicht verfügbar: ${detail} ` +
        `Trage in OPENAI_PRIMARY_MODEL einen Modellnamen ein, den dein Konto nutzen darf. ` +
        `Es wird bewusst keine Ersatzantwort erzeugt.`,
    );
    this.name = "OpenAiConfigurationError";
    this.model = model;
  }
}

export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  readonly isLocal = false;

  private readonly client: OpenAI;

  private readonly options: OpenAiOptions;

  constructor(options: OpenAiOptions) {
    this.options = options;
    this.client = new OpenAI({
      apiKey: options.apiKey,
      timeout: options.timeoutMs,
      baseURL: options.baseUrl,
      // Wiederholungen steuern wir selbst, damit ein 404 auf einen
      // unbekannten Modellnamen sofort als Konfigurationsfehler
      // durchschlägt statt dreimal zu warten.
      maxRetries: 0,
    });
  }

  /** Für die Stromfunktion weiter unten. Kein öffentlicher Vertrag. */
  rawClient(): OpenAI {
    return this.client;
  }

  modelFor(tier: ChatOptions["tier"]): string {
    return this.model(tier);
  }

  streamConversation(
    options: import("../provider.ts").ConversationOptions,
  ): AsyncIterable<import("../provider.ts").StreamEvent> {
    return streamOpenAiConversation(this, options);
  }

  private model(tier: ChatOptions["tier"]): string {
    if (tier === "fast") return this.options.modelFast;
    if (tier === "deep") return this.options.modelDeep;
    return this.options.modelInteractive;
  }

  /** Wiederholung mit wachsendem Abstand, höchstens dreimal. */
  private async withRetry<T>(model: string, run: () => Promise<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await run();
      } catch (error) {
        lastError = error;
        const status = (error as { status?: number }).status;

        if (status === 404 || status === 403) {
          const detail = (error as { message?: string }).message ?? "Kein Zugriff.";
          throw new OpenAiConfigurationError(model, detail);
        }
        if (!isRetryable(error) || attempt === 2) throw error;

        await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
      }
    }

    throw lastError;
  }

  async *chatStream(options: ChatOptions): AsyncIterable<string> {
    const model = this.model(options.tier);

    const stream = await this.withRetry(model, async () =>
      this.client.responses.stream(
        {
          model,
          instructions: options.system,
          input: options.messages.map((m) => ({ role: m.role, content: m.content })),
          max_output_tokens: options.maxTokens ?? this.options.maxTokens,
          temperature: options.temperature ?? 1,
        },
        options.signal ? { signal: options.signal } : undefined,
      ),
    );

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") yield event.delta;
    }
  }

  async structuredGenerate<T>(options: StructuredOptions<T>): Promise<StructuredResult<T>> {
    const start = Date.now();
    const model = this.model(options.tier);

    const response = await this.withRetry(model, () =>
      this.client.responses.create(
        {
          model,
          instructions: options.system,
          input: options.messages.map((m) => ({ role: m.role, content: m.content })),
          max_output_tokens: options.maxTokens ?? this.options.maxTokens,
          temperature: options.temperature ?? 0,
          text: {
            format: {
              type: "json_schema",
              name: options.schemaName,
              strict: true,
              schema: zodToJsonSchema(options.schema),
            },
          },
        },
        options.signal ? { signal: options.signal } : undefined,
      ),
    );

    const raw = response.output_text;
    if (!raw) {
      throw new Error(
        `Das Modell hat keine strukturierte Antwort zu "${options.schemaName}" geliefert. ` +
          `Es wird nichts gespeichert.`,
      );
    }

    // Zweite Prüfung gegen dasselbe Schema. Das Format kann stimmen und
    // der Inhalt trotzdem außerhalb der erlaubten Werte liegen.
    const data = options.schema.parse(JSON.parse(raw));

    return {
      data,
      rationale: null,
      usage: {
        inputTokens: response.usage?.input_tokens ?? null,
        outputTokens: response.usage?.output_tokens ?? null,
        model,
        provider: this.name,
        latencyMs: Date.now() - start,
      },
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    const response = await this.withRetry(this.options.modelEmbed, () =>
      this.client.embeddings.create({ model: this.options.modelEmbed, input: texts }),
    );
    return response.data.map((entry) => entry.embedding);
  }

  async *transcribe(audio: ArrayBuffer, locale: string): AsyncIterable<TranscriptChunk> {
    const model = this.options.transcribeModel;
    if (!model) throw new AiCapabilityError(this.name, "transcribe");

    const file = new File([audio], "aufnahme.webm", { type: "audio/webm" });
    const result = await this.withRetry(model, () =>
      this.client.audio.transcriptions.create({
        file,
        model,
        language: locale.slice(0, 2),
      }),
    );

    yield { text: result.text, isFinal: true };
  }

  async synthesize(text: string, _locale: string): Promise<ArrayBuffer> {
    const model = this.options.speechModel;
    if (!model) throw new AiCapabilityError(this.name, "synthesize");

    const response = await this.withRetry(model, () =>
      this.client.audio.speech.create({
        model,
        voice: this.options.speechVoice ?? "alloy",
        input: text,
      }),
    );

    return response.arrayBuffer();
  }
}

/**
 * Gespräch mit Werkzeugen — als Ereignisstrom.
 *
 * Werkzeugargumente kommen in Teilstücken an. Sie werden je Aufruf
 * gesammelt und erst beim Abschlussereignis geparst: ein Teilstück ist
 * kein gültiges JSON, und ein Parseversuch darauf erzeugt genau die
 * Sorte Fehler, die man später an der falschen Stelle sucht.
 */
export async function* streamOpenAiConversation(
  provider: OpenAiProvider,
  options: import("../provider.ts").ConversationOptions,
): AsyncIterable<import("../provider.ts").StreamEvent> {
  const start = Date.now();
  const client = provider.rawClient();
  const model = provider.modelFor(options.tier);

  const stream = await client.responses.stream(
    {
      model,
      instructions: options.system,
      input: options.messages.map((m) => ({ role: m.role, content: m.content })),
      max_output_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.8,
      tools: (options.tools ?? []).map((tool) => ({
        type: "function" as const,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        strict: false,
      })),
    },
    options.signal ? { signal: options.signal } : undefined,
  );

  const argumentBuffers = new Map<string, { name: string; args: string }>();
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") {
      yield { type: "text", delta: event.delta };
      continue;
    }

    if (event.type === "response.output_item.added" && event.item.type === "function_call") {
      argumentBuffers.set(event.item.id ?? String(event.output_index), {
        name: event.item.name,
        args: "",
      });
      continue;
    }

    if (event.type === "response.function_call_arguments.delta") {
      const buffer = argumentBuffers.get(event.item_id);
      if (buffer) buffer.args += event.delta;
      continue;
    }

    if (event.type === "response.function_call_arguments.done") {
      const buffer = argumentBuffers.get(event.item_id);
      if (!buffer) continue;
      argumentBuffers.delete(event.item_id);

      let input: unknown;
      try {
        input = JSON.parse(buffer.args || "{}");
      } catch {
        // Ungültiges JSON ist kein Grund, das Gespräch abzubrechen: der
        // Aufruf wird verworfen und der Fehler zurückgemeldet.
        yield {
          type: "error",
          message: `Der Werkzeugaufruf ${buffer.name} war nicht lesbar und wurde verworfen.`,
        };
        continue;
      }

      yield { type: "tool_call", id: event.item_id, name: buffer.name, input };
      continue;
    }

    if (event.type === "response.completed") {
      inputTokens = event.response.usage?.input_tokens ?? null;
      outputTokens = event.response.usage?.output_tokens ?? null;
    }
  }

  yield {
    type: "done",
    usage: {
      inputTokens,
      outputTokens,
      model,
      provider: "openai",
      latencyMs: Date.now() - start,
    },
  };
}
