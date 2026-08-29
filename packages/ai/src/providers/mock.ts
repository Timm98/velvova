import { createHash } from "node:crypto";
import type { z } from "zod";
import {
  AiCapabilityError,
  type AiProvider,
  type ChatOptions,
  type StructuredOptions,
  type StructuredResult,
  type TranscriptChunk,
} from "../provider.ts";

/**
 * Deterministischer lokaler Provider.
 *
 * Er ist kein Platzhalter, sondern der Standardweg: ohne konfigurierten
 * Schlüssel läuft das gesamte Produkt hierüber. Das hat zwei Gründe.
 * Erstens muss ein neuer Entwickler ohne Zugangsdaten arbeiten können.
 * Zweitens brauchen Tests reproduzierbare Antworten - ein echtes Modell
 * liefert bei gleichem Eingang nicht zweimal dasselbe.
 *
 * Er gibt sich nie als echtes Modell aus: `name` ist "mock", und die
 * Oberfläche zeigt das an.
 */

function seededNumber(input: string): number {
  const h = createHash("sha256").update(input).digest();
  return h.readUInt32BE(0) / 0xffffffff;
}

function pick<T>(items: readonly T[], seed: string): T {
  return items[Math.floor(seededNumber(seed) * items.length)]!;
}

/**
 * Erzeugt aus einem Zod-Schema ein plausibles, schema-gültiges Objekt.
 * Bewusst schlicht gehalten: es geht um Struktur, nicht um Inhalt.
 */
function synthesiseFromSchema<T>(schema: z.ZodType<T>, seed: string): T {
  // Zod 4 stellt die interne Form über _zod.def bereit.
  const walk = (s: unknown, path: string): unknown => {
    const def = (s as { _zod?: { def?: Record<string, unknown> } })?._zod?.def;
    const type = def?.type as string | undefined;

    switch (type) {
      case "object": {
        const shape = (def!.shape ?? {}) as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(shape)) out[key] = walk(value, `${path}.${key}`);
        return out;
      }
      case "array":
        return [walk(def!.element, `${path}[0]`), walk(def!.element, `${path}[1]`)];
      case "string":
        return `Demo-Antwort für ${path.split(".").pop() ?? "Feld"}`;
      case "number":
        return Math.round(seededNumber(path + seed) * 100) / 100;
      case "boolean":
        return seededNumber(path + seed) > 0.5;
      case "enum": {
        const values = Object.values((def!.entries ?? {}) as Record<string, string>);
        return values.length > 0 ? pick(values, path + seed) : "unknown";
      }
      case "literal":
        return (def!.values as unknown[])?.[0];
      case "nullable":
      case "optional":
        return walk(def!.innerType, path);
      case "default":
        return typeof def!.defaultValue === "function"
          ? (def!.defaultValue as () => unknown)()
          : def!.defaultValue;
      case "date":
        return new Date("2026-08-01T00:00:00Z");
      case "record":
        return {};
      case "union":
        return walk((def!.options as unknown[])?.[0], path);
      default:
        return null;
    }
  };

  const raw = walk(schema, "root");
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  // Schlägt die Synthese fehl, ist das ein Fehler im Schema oder hier -
  // und soll laut auffallen, nicht stillschweigend etwas Falsches liefern.
  throw new Error(
    `Der Demo-Anbieter konnte kein gültiges Objekt für "${(schema as { description?: string }).description ?? "Schema"}" ` +
      `erzeugen: ${parsed.error.message}`,
  );
}

/** Antworten, die zum jeweiligen Interviewthema passen. */
const STAGE_REPLIES: Record<string, string[]> = {
  consent_and_goal: [
    "Bevor ich dir Jobs zeige, möchte ich verstehen, was du wirklich kannst, was dir Energie gibt und welche Bedingungen du brauchst. Was soll sich durch deine nächste berufliche Entscheidung konkret verändern?",
  ],
  current_situation: [
    "Danke. Erzähl mir kurz, wo du gerade stehst: Was machst du im Moment, und seit wann?",
  ],
  experience_episodes: [
    "Erzähl von einer Aufgabe, bei der du die Zeit vergessen hast. Was hast du dabei tatsächlich getan?",
    "Welches Problem hast du zuletzt selbstständig gelöst? Mich interessiert vor allem, welche Schritte du gewählt hast.",
  ],
  tasks_and_energy: [
    "Welche Tätigkeit fällt dir leicht, die andere häufig schwierig finden? Und gibt es dafür ein konkretes Beispiel?",
    "Welche Aufgaben kannst du gut, obwohl sie dich viel Energie kosten?",
  ],
  hard_constraints: [
    "Jetzt zu den Grenzen: Welche drei Bedingungen sind für deinen nächsten Job nicht verhandelbar?",
  ],
  location_and_logistics: [
    "Welche Standorte, Pendelzeiten und Remote-Anteile kommen für dich in Frage?",
  ],
};

const GENERIC_REPLIES = [
  "Verstanden. Kannst du mir dazu ein konkretes Beispiel nennen - was genau war dein Anteil daran?",
  "Das notiere ich als deine Angabe. Was ist daraus am Ende geworden?",
  "Danke. Damit ich es richtig einordne: Wobei bitten dich andere regelmäßig um Hilfe?",
];

import type { ConversationOptions, StreamEvent } from "../provider.ts";

export class MockAiProvider implements AiProvider {
  readonly name = "mock";
  readonly isLocal = true;

  async *chatStream(options: ChatOptions): AsyncIterable<string> {
    const last = options.messages.at(-1)?.content ?? "";
    const stageMatch = /AKTUELLES THEMA\n(\w+)/.exec(options.system);
    const stage = stageMatch?.[1] ?? "";
    const pool = STAGE_REPLIES[stage] ?? GENERIC_REPLIES;
    const reply = pick(pool, last + stage);

    // In Woertern ausgeben, damit die Oberfläche denselben Streaming-Weg
    // nutzt wie bei einem echten Anbieter.
    for (const word of reply.split(" ")) {
      yield word + " ";
      await new Promise((r) => setTimeout(r, 8));
    }
  }

  async structuredGenerate<T>(options: StructuredOptions<T>): Promise<StructuredResult<T>> {
    const seed = options.schemaName + (options.messages.at(-1)?.content ?? "");
    const start = Date.now();
    const data = synthesiseFromSchema(options.schema, seed);
    return {
      data,
      usage: {
        inputTokens: null,
        outputTokens: null,
        model: "mock",
        provider: "mock",
        latencyMs: Date.now() - start,
      },
      rationale: "Demo-Anbieter: strukturell gültiges Beispiel ohne inhaltliche Aussage.",
    };
  }

  /**
   * Deterministische Vektoren aus einem Hash. Sie tragen keine Semantik -
   * ähnliche Texte liegen nicht beieinander. Für die Demo reicht das,
   * für echte semantische Suche braucht es einen richtigen Anbieter.
   * Genau das steht auch in der Oberfläche.
   */
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => {
      const h = createHash("sha256").update(t).digest();
      return Array.from({ length: 64 }, (_, i) => (h[i % h.length]! / 255) * 2 - 1);
    });
  }

  async *transcribe(_audio: ArrayBuffer, _locale: string): AsyncIterable<TranscriptChunk> {
    throw new AiCapabilityError(this.name, "transcribe");
  }

  async synthesize(_text: string, _locale: string): Promise<ArrayBuffer> {
    throw new AiCapabilityError(this.name, "synthesize");
  }

  /**
   * Gespräch ohne Modell.
   *
   * Der Text wird in Stücken ausgegeben, damit die Oberfläche denselben
   * Weg nimmt wie im Betrieb — Fehler im Strom fallen sonst erst auf,
   * wenn ein Schlüssel hinterlegt wird.
   *
   * Werkzeuge ruft dieser Anbieter nicht auf. Ein Demo-Anbieter, der so
   * tut, als schriebe er Daten, wäre schlimmer als gar keiner.
   */
  async *streamConversation(options: ConversationOptions): AsyncIterable<StreamEvent> {
    const start = Date.now();
    const last = options.messages.at(-1)?.content ?? "";
    const text =
      "Das ist eine Beispielantwort des lokalen Anbieters — sie hat keine inhaltliche Aussage. " +
      "Deine Angabe wurde trotzdem gespeichert und fließt in dein Profil ein; die Bewertungslogik " +
      "braucht kein Sprachmodell. " +
      (last.length > 0 ? `Aufgenommen: ${last.slice(0, 120)}` : "");

    for (const chunk of text.match(/.{1,24}(\s|$)/g) ?? [text]) {
      await new Promise((resolve) => setTimeout(resolve, 12));
      yield { type: "text", delta: chunk };
    }

    yield {
      type: "done",
      usage: {
        inputTokens: null,
        outputTokens: null,
        model: "local-mock",
        provider: "mock",
        latencyMs: Date.now() - start,
      },
    };
  }
}
