import Anthropic from "@anthropic-ai/sdk";
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
 * Echter Anbieter. Wird nur benutzt, wenn AI_PROVIDER=anthropic gesetzt
 * UND ein Schlüssel vorliegt - sonst fällt die Auswahl auf den lokalen
 * Anbieter zurück und die Oberfläche zeigt "nicht verbunden".
 *
 * Strukturierte Ausgaben laufen über Tool Use mit erzwungener Auswahl.
 * Das ist verlaesslicher als freien Text zu parsen: das Modell muss dem
 * Schema folgen, und die Antwort wird anschliessend noch einmal gegen
 * dasselbe Zod-Schema geprüft, bevor sie irgendwo landet.
 */

export interface AnthropicOptions {
  apiKey: string;
  modelStrong: string;
  modelFast: string;
  maxTokens: number;
  timeoutMs: number;
}

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  readonly isLocal = false;

  private readonly client: Anthropic;

  private readonly options: AnthropicOptions;

  constructor(options: AnthropicOptions) {
    this.options = options;
    this.client = new Anthropic({ apiKey: options.apiKey, timeout: options.timeoutMs });
  }

  private model(tier: ChatOptions["tier"]): string {
    return tier === "fast" ? this.options.modelFast : this.options.modelStrong;
  }

  async *chatStream(options: ChatOptions): AsyncIterable<string> {
    const stream = this.client.messages.stream(
      {
        model: this.model(options.tier),
        max_tokens: options.maxTokens ?? this.options.maxTokens,
        temperature: options.temperature ?? 1,
        system: options.system,
        messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
      },
      options.signal ? { signal: options.signal } : undefined,
    );

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  }

  async structuredGenerate<T>(options: StructuredOptions<T>): Promise<StructuredResult<T>> {
    const start = Date.now();
    const model = this.model(options.tier);

    const response = await this.client.messages.create(
      {
        model,
        max_tokens: options.maxTokens ?? this.options.maxTokens,
        temperature: options.temperature ?? 0,
        system: options.system,
        messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
        tools: [
          {
            name: options.schemaName,
            description: `Gib das Ergebnis ausschließlich über dieses Werkzeug zurück.`,
            input_schema: zodToJsonSchema(options.schema) as Anthropic.Tool["input_schema"],
          },
        ],
        tool_choice: { type: "tool", name: options.schemaName },
      },
      options.signal ? { signal: options.signal } : undefined,
    );

    const toolUse = response.content.find((c): c is Anthropic.ToolUseBlock => c.type === "tool_use");
    if (!toolUse) {
      throw new Error(
        `Der Anbieter hat kein strukturiertes Ergebnis geliefert (Schema: ${options.schemaName}). ` +
          `Stopgrund: ${response.stop_reason ?? "unbekannt"}.`,
      );
    }

    // Zweite Prüfung gegen dasselbe Schema. Eine Modellantwort wird nie
    // ungeprueft zur Wahrheit in der Datenbank.
    const parsed = options.schema.safeParse(toolUse.input);
    if (!parsed.success) {
      throw new Error(
        `Das Ergebnis entspricht nicht dem Schema "${options.schemaName}": ${parsed.error.message}`,
      );
    }

    const text = response.content.find((c) => c.type === "text");
    return {
      data: parsed.data,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model,
        provider: this.name,
        latencyMs: Date.now() - start,
      },
      rationale: text && text.type === "text" ? text.text.slice(0, 500) : null,
    };
  }

  async embed(_texts: string[]): Promise<number[][]> {
    // Der Anbieter stellt keine eigenen Embeddings bereit. Ehrlich fehlschlagen
    // statt eine schlechte Ersatzlösung zu liefern, die niemand erwartet.
    throw new AiCapabilityError(this.name, "embed");
  }

  async *transcribe(_audio: ArrayBuffer, _locale: string): AsyncIterable<TranscriptChunk> {
    throw new AiCapabilityError(this.name, "transcribe");
  }

  async synthesize(_text: string, _locale: string): Promise<ArrayBuffer> {
    throw new AiCapabilityError(this.name, "synthesize");
  }
}
