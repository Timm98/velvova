import OpenAI from "openai";
import { zodToJsonSchema } from "../jsonSchema.ts";
import { OpenAiConfigurationError } from "./errors.ts";

export { OpenAiConfigurationError };
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
  /**
   * Was einspringt, wenn das eigentliche Modell ausfällt.
   *
   * Fehlt der Eintrag, gibt es keinen Ersatz — und ein Ausfall bleibt
   * ein Ausfall. Das ist Absicht: Ein erfundener Ersatz wäre
   * schlimmer als eine ehrliche Fehlermeldung.
   */
  modelInteractiveFallback?: string;
  modelDeepFallback?: string;
  modelFastFallback?: string;
  modelEmbedFallback?: string;
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

/**
 * Verträgt dieses Modell `temperature`?
 *
 * Die Reasoning-Modelle (gpt-5, o1, o3, o4) lehnen den Parameter ab —
 * mit HTTP 400 und der Meldung
 *
 *     Unsupported parameter: 'temperature' is not supported with this model.
 *
 * Der Aufruf schlägt dabei vollständig fehl, es kommt kein einziges
 * Zeichen zurück. In einem Ereignisstrom sieht das aus wie „Monday hat
 * nicht geantwortet“, nicht wie ein Konfigurationsfehler — und genau so
 * ist es hier aufgefallen: die Nutzernachrichten landeten in der
 * Datenbank, die Antworten nicht.
 *
 * Bewusst eine Positivliste über Präfixe statt einer Fehlerbehandlung
 * im Nachhinein: einen Parameter erst zu schicken und dann auf den
 * Fehler zu reagieren, kostet bei jedem Aufruf eine volle Antwortzeit.
 */
/**
 * Ob dieses Modell `temperature` annimmt.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Liste nach oben offen sein muss
 * ══════════════════════════════════════════════════════════════
 *
 * Das Muster stand bei `^(gpt-5|o1|o3|o4)`. Es fing die damals
 * bekannten Denkmodelle und liess `gpt-6-astra` durch — jeder Aufruf
 * endete mit:
 *
 *   400 Unsupported parameter: 'temperature' is not supported
 *       with this model.
 *
 * Gefunden im Benchmark, nicht im Betrieb: Astra war als höchste
 * Stufe eingetragen und hätte bei der ersten wichtigen Analyse
 * versagt.
 *
 * `gpt-6` und alles darüber sind Denkmodelle; die Annahme, dass die
 * nächste Generation wieder Temperatur annimmt, wäre die Wette, die
 * hier schon einmal verloren ging.
 */
function unterstütztTemperature(model: string): boolean {
  return !istDenkmodell(model);
}

/**
 * Ist das ein Modell, das vor der Antwort nachdenkt?
 *
 * ── Warum diese Regel exportiert wird ───────────────────────────
 *
 * Weil die Oberfläche eine Denkintensität nur anbieten darf, wo sie
 * ankommt. Die Frage „unterstützt dieses Modell das?" muss dieselbe
 * Antwort geben wie die Stelle, die den Parameter tatsächlich setzt
 * — sonst steht irgendwann ein Schalter da, der nichts tut.
 *
 * Deshalb keine zweite Liste im Katalog, sondern genau dieser
 * Ausdruck, an einer Stelle.
 */
export function istDenkmodell(model: string): boolean {
  return /^(gpt-[5-9]|gpt-[1-9][0-9]|o[1-9])/.test(model);
}

/**
 * Wie viele Ausgabetoken höchstens?
 *
 * Bei Reasoning-Modellen zählen die internen Denkschritte in dieses
 * Budget. 4096 reichen dort für die Gedanken und lassen für die Antwort
 * nichts übrig — die Antwort kommt dann leer zurück, ohne Fehler.
 */
function ausgabegrenze(model: string, gewünscht: number): number {
  return unterstütztTemperature(model) ? gewünscht : Math.max(gewünscht, 16_000);
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

  /**
   * Wie lange auf eine Antwort gewartet wird.
   *
   * ══════════════════════════════════════════════════════════════
   * Warum je Stufe eine andere
   * ══════════════════════════════════════════════════════════════
   *
   * Eine Extraktion, die nach fünfzehn Sekunden nicht fertig ist,
   * wird es auch nach neunzig nicht — dort ist etwas kaputt, und
   * langes Warten macht aus einem schnellen Fehler einen langsamen.
   *
   * Eine tiefe Analyse dagegen darf dauern. Sie läuft im Hintergrund,
   * und niemand sitzt davor. Sie nach dreissig Sekunden abzubrechen
   * hiesse, das teuerste Modell zu bezahlen und sein Ergebnis
   * wegzuwerfen.
   *
   * Die gemeinsame Grenze aus `AI_TIMEOUT_MS` bleibt die Obergrenze:
   * Wer sie niedriger setzt, meint es so.
   */
  private zeitgrenze(tier: ChatOptions["tier"], gewuenscht?: number): number {
    /*
     * ── Warum FAST nicht 15 Sekunden bekommt ────────────────────
     *
     * Die erste Fassung stand dort. Der Gedanke: Eine Extraktion, die
     * nach fünfzehn Sekunden nicht fertig ist, wird es auch nach
     * neunzig nicht.
     *
     * Der erste Lauf danach widerlegte ihn. Systemprompt 2 läuft auf
     * `fast` und beurteilt fünf Kandidaten in einem Aufruf — mit
     * Stellendaten, Kriterien und Belegen im Kontext. Er brauchte
     * länger als fünfzehn Sekunden und brach ab: „Request timed out."
     *
     * Der Denkfehler war, von der Stufe auf die Grösse der Aufgabe zu
     * schliessen. `fast` sagt, welches Modell rechnet, nicht wie viel
     * es zu lesen bekommt. Ein Stapelaufruf ist auch mit einem
     * schnellen Modell eine grosse Aufgabe.
     *
     * Deshalb: Der Aufrufer darf sagen, was er braucht. Ohne Angabe
     * gilt ein Wert je Stufe, und der ist für `fast` nicht mehr
     * knapp bemessen.
     */
    const jeStufe = tier === "fast" ? 45_000 : tier === "deep" ? 90_000 : 30_000;
    return Math.min(gewuenscht ?? jeStufe, this.options.timeoutMs);
  }

  private model(tier: ChatOptions["tier"]): string {
    if (tier === "fast") return this.options.modelFast;
    if (tier === "deep") return this.options.modelDeep;
    return this.options.modelInteractive;
  }

  /**
   * Das Ersatzmodell einer Stufe — oder nichts.
   *
   * ══════════════════════════════════════════════════════════════
   * Warum es einen Ersatz braucht und keinen weiteren Versuch
   * ══════════════════════════════════════════════════════════════
   *
   * `withRetry` wiederholt bei 429 und 5xx — sinnvoll, denn dieselbe
   * Anfrage kann beim zweiten Mal durchgehen.
   *
   * Bei 404 hilft Wiederholen nicht. Das Modell gibt es nicht, und
   * es wird es auch beim dritten Versuch nicht geben. Genau das ist
   * uns passiert: Drei Modellnamen standen als Grundwert im Code,
   * die es auf unserem Konto nie gab.
   *
   * Ein Ersatzmodell ist die einzige Antwort, die den Nutzer nicht
   * mit einem Fehler zurücklässt.
   */
  private ersatzmodell(tier: ChatOptions["tier"]): string | null {
    const ersatz =
      tier === "fast"
        ? this.options.modelFastFallback
        : tier === "deep"
          ? this.options.modelDeepFallback
          : this.options.modelInteractiveFallback;

    if (!ersatz) return null;
    /*
     * Derselbe Name wäre kein Ersatz, sondern eine Schleife. Das
     * passiert leicht, wenn jemand die Umgebungsvariablen kopiert.
     */
    return ersatz === this.model(tier) ? null : ersatz;
  }

  /** Wiederholung mit wachsendem Abstand, höchstens dreimal. */
  /**
   * Ein Aufruf, und wenn das Modell fehlt, derselbe mit dem Ersatz.
   *
   * ── Warum nur einmal ausgewichen wird ───────────────────────
   *
   * Eine Kette über drei Modelle würde bei einer falsch gesetzten
   * Umgebung drei Fehlschläge nacheinander erzeugen und die Antwort
   * um ihre Zeitgrenzen verlängern. Einmal ausweichen deckt den
   * realen Fall ab: ein Modell ist weg, die anderen sind da.
   *
   * Der Wechsel steht im Rückgabewert, damit das Protokoll ihn
   * festhalten kann. Ein stiller Modellwechsel wäre die Sorte
   * Verbesserung, die man erst in der Rechnung bemerkt.
   */
  protected async mitErsatz<T>(
    tier: ChatOptions["tier"],
    run: (model: string) => Promise<T>,
  ): Promise<{ wert: T; modell: string; ersatzGenutzt: boolean }> {
    const erst = this.model(tier);
    try {
      return { wert: await this.withRetry(erst, () => run(erst)), modell: erst, ersatzGenutzt: false };
    } catch (fehler) {
      const ersatz = this.ersatzmodell(tier);
      /*
       * Nur bei einem Konfigurationsfehler ausweichen — also wenn das
       * Modell nicht existiert oder gesperrt ist.
       *
       * Bei einem Zeitüberschreiten oder einem 500 wäre der Ersatz
       * eine zweite Wette auf dieselbe Störung; `withRetry` hat es
       * dann schon dreimal versucht.
       */
      if (!ersatz || !(fehler instanceof OpenAiConfigurationError)) throw fehler;
      return {
        wert: await this.withRetry(ersatz, () => run(ersatz)),
        modell: ersatz,
        ersatzGenutzt: true,
      };
    }
  }

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
          max_output_tokens: ausgabegrenze(model, options.maxTokens ?? this.options.maxTokens),
          ...(unterstütztTemperature(model) ? { temperature: options.temperature ?? 1 } : {}),
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
    /* Ein ausdrücklich genanntes Modell schlägt die Stufe — siehe
       `StructuredOptions.modell`. */
    const model = options.modell ?? this.model(options.tier);

    const response = await this.withRetry(model, () =>
      this.client.responses.create(
        {
          model,
          instructions: options.system,
          input: options.messages.map((m) => ({ role: m.role, content: m.content })),
          max_output_tokens: ausgabegrenze(model, options.maxTokens ?? this.options.maxTokens),
          ...(unterstütztTemperature(model) ? { temperature: options.temperature ?? 0 } : {}),
          text: {
            format: {
              type: "json_schema",
              name: options.schemaName,
              strict: true,
              schema: zodToJsonSchema(options.schema),
            },
          },
        },
        {
          timeout: this.zeitgrenze(options.tier, options.timeoutMs),
          ...(options.signal ? { signal: options.signal } : {}),
        },
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

  /*
   * Die Eingabe: das Gespräch, danach die Ergebnisse bereits gelaufener
   * Werkzeuge.
   *
   * Ohne diesen zweiten Teil endet ein Zug mit einem Werkzeugaufruf und
   * ganz ohne Text — das Modell hat etwas getan und nie erzählt, was
   * dabei herauskam. In der Oberfläche sieht das aus, als hätte Monday
   * geschwiegen.
   */
  const eingabe: Record<string, unknown>[] = options.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  for (const ergebnis of options.toolResults ?? []) {
    eingabe.push({
      type: "function_call",
      call_id: ergebnis.id,
      name: ergebnis.name,
      arguments: JSON.stringify(ergebnis.arguments ?? {}),
    });
    eingabe.push({
      type: "function_call_output",
      call_id: ergebnis.id,
      output: JSON.stringify(ergebnis.output ?? {}),
    });
  }

  const stream = await client.responses.stream(
    {
      model,
      instructions: options.system,
      input: eingabe as never,
      max_output_tokens: ausgabegrenze(model, options.maxTokens ?? 4096),
      ...(unterstütztTemperature(model) ? { temperature: options.temperature ?? 0.8 } : {}),
      /*
       * Denkaufwand bewusst niedrig für das Gespräch.
       *
       * Bei einem Reasoning-Modell zählen die inneren Schritte in die
       * Antwortzeit. Ohne diese Zeile lag ein einfacher Gesprächszug bei
       * 21 Sekunden — für eine Rückfrage im Gespräch ist das keine
       * Rückfrage mehr. Die tiefe Stufe bekommt ihren Aufwand über den
       * Router, nicht über diesen Standardwert.
       */
      ...(unterstütztTemperature(model)
        ? {}
        : {
            reasoning: {
              /*
               * Die ausdrückliche Wahl gewinnt.
               *
               * Ohne sie bleibt es beim Standard aus der Stufe: Bei
               * einem Reasoning-Modell zählen die inneren Schritte in
               * die Antwortzeit, und für eine Rückfrage im Gespräch
               * wären einundzwanzig Sekunden keine Rückfrage mehr.
               */
              effort:
                options.denktiefe === "hoch"
                  ? "high"
                  : options.denktiefe === "mittel"
                    ? "medium"
                    : options.denktiefe === "niedrig"
                      ? "low"
                      : options.tier === "deep"
                        ? "medium"
                        : "low",
            } as never,
          }),
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
