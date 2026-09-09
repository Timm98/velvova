import type { z } from "zod";
import {
  AiCapabilityError,
  type AiProvider,
  type AiUsage,
  type ChatOptions,
  type ConversationOptions,
  type StreamEvent,
  type StructuredOptions,
  type StructuredResult,
  type TranscriptChunk,
} from "../provider.ts";
import { zodToJsonSchema } from "../jsonSchema.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Der dritte Adapter — Google, über die REST-Schnittstelle
 * ══════════════════════════════════════════════════════════════════
 *
 * ── Warum ohne SDK ─────────────────────────────────────────────
 *
 * Weil ein SDK eine Abhängigkeit mit eigener Versionsgeschichte ist,
 * und die Schnittstelle darunter seit Jahren stabil dieselbe Form
 * hat: ein POST mit `contents`, eine Antwort mit `candidates`. Was
 * das SDK zusätzlich bringt — Wiederholungen, Typen, Hilfsfunktionen
 * — haben wir hier bereits oder wollen es an dieser Stelle nicht.
 *
 * Der Ausschlag gab ein praktischer Punkt: Ein neues Paket in
 * `package.json` heisst Installation, Sperrdatei, Prüfung im Bau. Ein
 * `fetch` heisst nichts davon.
 *
 * ── Was hier ehrlich gesagt werden muss ────────────────────────
 *
 * Dieser Adapter ist gegen die dokumentierte Form der Schnittstelle
 * geschrieben und wurde von hier aus gegen KEINE laufende API
 * geprüft. Es lag kein Schlüssel vor.
 *
 * Deshalb bleibt `MONDAY_GOOGLE_PRODUCTION_APPROVED` auf `false`, und
 * die Registry lässt kein Gemini-Modell in die Auswahl, bis jemand
 * einen echten Aufruf gemacht hat. Der Adapter zu existieren ist eine
 * Voraussetzung dafür, nicht der Nachweis.
 *
 * ── Was er absichtlich NICHT kann ──────────────────────────────
 *
 * Einbettungen, Transkription und Sprachausgabe werfen einen klaren
 * Fehler. Nicht weil Google das nicht könnte, sondern weil es im
 * Produkt woanders liegt: Einbettungen laufen über ein Modell, dessen
 * Vektoren zu den gespeicherten passen — ein Wechsel dort macht den
 * Bestand unbrauchbar, ohne dass irgendwo ein Fehler steht.
 */

const BASIS = "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiOptions {
  apiKey: string;
  modelInteractive: string;
  modelDeep: string;
  modelFast: string;
  maxTokens: number;
  timeoutMs: number;
}

interface GeminiTeil {
  text?: string;
  functionCall?: { name: string; args?: unknown };
}

interface GeminiAntwort {
  candidates?: { content?: { parts?: GeminiTeil[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string; status?: string };
}

/**
 * Was Gemini von einem JSON Schema akzeptiert.
 *
 * Die Schnittstelle nimmt eine Teilmenge von OpenAPI 3.0 und lehnt
 * Schlüsselwörter aus JSON Schema ab, die sie nicht kennt —
 * `$schema`, `additionalProperties`, `definitions` und Verwandte.
 * `zodToJsonSchema` erzeugt Draft-7 und damit genau diese.
 *
 * Der Filter wirft sie weg, statt sie zu übersetzen. Ein
 * Schlüsselwort, das nicht ankommt, kostet eine Einschränkung; eines,
 * das falsch übersetzt ankommt, kostet die Antwort.
 */
const UNBEKANNT = new Set([
  "$schema", "$id", "$ref", "$defs", "definitions",
  "additionalProperties", "patternProperties", "const",
  "allOf", "oneOf", "not", "examples", "default",
]);

export function fuerGeminiSaeubern(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(fuerGeminiSaeubern);
  if (schema === null || typeof schema !== "object") return schema;

  const raus: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
    if (UNBEKANNT.has(k)) continue;
    raus[k] = fuerGeminiSaeubern(v);
  }
  return raus;
}

export class GeminiProvider implements AiProvider {
  readonly name = "google";
  readonly isLocal = false;

  constructor(private readonly options: GeminiOptions) {}

  private modell(tier: ChatOptions["tier"], ausdruecklich?: string): string {
    if (ausdruecklich) return ausdruecklich;
    if (tier === "fast") return this.options.modelFast;
    if (tier === "deep") return this.options.modelDeep;
    return this.options.modelInteractive;
  }

  /**
   * Der Rumpf einer Anfrage.
   *
   * `system` geht als `systemInstruction` und nicht als erste
   * Nachricht: Als Nachricht wäre es für das Modell eine Aussage des
   * Nutzers und damit etwas, das ein späterer Text im Gespräch
   * überschreiben kann. Genau das ist der Weg, auf dem eine
   * Stellenanzeige mit eingebauter Anweisung die Regeln ändert.
   */
  private rumpf(o: ChatOptions): Record<string, unknown> {
    return {
      systemInstruction: { parts: [{ text: o.system }] },
      contents: o.messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        maxOutputTokens: o.maxTokens ?? this.options.maxTokens,
        temperature: o.temperature ?? 1,
      },
    };
  }

  private async anfragen(
    modell: string,
    pfad: "generateContent" | "streamGenerateContent",
    rumpf: Record<string, unknown>,
    signal: AbortSignal | undefined,
    zusatz = "",
  ): Promise<Response> {
    const antwort = await fetch(`${BASIS}/models/${modell}:${pfad}${zusatz}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        /*
         * Der Schlüssel geht in eine Kopfzeile, nicht in die Adresse.
         *
         * Ein `?key=…` steht in jedem Zugriffsprotokoll, in jeder
         * Fehlermeldung mit URL und in jedem Netzwerk-Werkzeug.
         */
        "x-goog-api-key": this.options.apiKey,
      },
      body: JSON.stringify(rumpf),
      signal,
    });

    if (!antwort.ok) {
      /*
       * Den Text lesen, aber nicht ungefiltert weiterreichen: Eine
       * Fehlerantwort kann die gesendete Anfrage spiegeln, und darin
       * steht der Kontext des Menschen.
       */
      const text = await antwort.text().catch(() => "");
      let grund = "";
      try {
        grund = (JSON.parse(text) as GeminiAntwort).error?.message ?? "";
      } catch {
        /* Kein JSON. Dann eben ohne Grund. */
      }
      throw new Error(
        `Google antwortete mit ${antwort.status}${grund ? `: ${grund.slice(0, 200)}` : ""}`,
      );
    }
    return antwort;
  }

  private frist(o: ChatOptions): AbortSignal {
    const eigen = AbortSignal.timeout(o.timeoutMs ?? this.options.timeoutMs);
    return o.signal ? AbortSignal.any([o.signal, eigen]) : eigen;
  }

  async *chatStream(o: ChatOptions): AsyncIterable<string> {
    const antwort = await this.anfragen(
      this.modell(o.tier, o.modell), "streamGenerateContent",
      this.rumpf(o), this.frist(o), "?alt=sse",
    );
    for await (const stueck of sseLesen(antwort)) {
      for (const teil of stueck.candidates?.[0]?.content?.parts ?? []) {
        if (teil.text) yield teil.text;
      }
    }
  }

  async *streamConversation(o: ConversationOptions): AsyncIterable<StreamEvent> {
    const modell = this.modell(o.tier, o.modell);
    const beginn = Date.now();

    const rumpf = this.rumpf(o);
    if (o.tools?.length) {
      rumpf.tools = [{
        functionDeclarations: o.tools.map((w) => ({
          name: w.name,
          description: w.description,
          parameters: fuerGeminiSaeubern(w.parameters),
        })),
      }];
    }

    /*
     * Ergebnisse bereits gelaufener Werkzeuge gehören ans Ende der
     * Unterhaltung, in der Form, die Google dafür kennt.
     */
    if (o.toolResults?.length) {
      (rumpf.contents as unknown[]).push({
        role: "user",
        parts: o.toolResults.map((e) => ({
          functionResponse: { name: e.name, response: { ergebnis: e.output } },
        })),
      });
    }

    let ein: number | null = null;
    let aus: number | null = null;

    try {
      const antwort = await this.anfragen(
        modell, "streamGenerateContent", rumpf, this.frist(o), "?alt=sse",
      );

      let nummer = 0;
      for await (const stueck of sseLesen(antwort)) {
        ein = stueck.usageMetadata?.promptTokenCount ?? ein;
        aus = stueck.usageMetadata?.candidatesTokenCount ?? aus;

        for (const teil of stueck.candidates?.[0]?.content?.parts ?? []) {
          if (teil.text) yield { type: "text", delta: teil.text };
          if (teil.functionCall) {
            /*
             * Google vergibt keine Aufrufkennung. Wir vergeben eine,
             * weil der Rest des Produkts Ergebnis und Aufruf über sie
             * zusammenführt — und weil zwei Aufrufe desselben
             * Werkzeugs in einer Runde sonst nicht auseinanderzuhalten
             * wären.
             */
            yield {
              type: "tool_call",
              id: `google-${beginn}-${nummer++}`,
              name: teil.functionCall.name,
              input: teil.functionCall.args ?? {},
            };
          }
        }
      }

      yield {
        type: "done",
        usage: {
          inputTokens: ein, outputTokens: aus,
          model: modell, provider: this.name, latencyMs: Date.now() - beginn,
        },
      };
    } catch (fehler) {
      yield {
        type: "error",
        message: fehler instanceof Error ? fehler.message : String(fehler),
      };
    }
  }

  async structuredGenerate<T>(o: StructuredOptions<T>): Promise<StructuredResult<T>> {
    const modell = this.modell(o.tier, o.modell);
    const beginn = Date.now();

    const rumpf = this.rumpf(o);
    (rumpf.generationConfig as Record<string, unknown>).responseMimeType = "application/json";
    (rumpf.generationConfig as Record<string, unknown>).responseSchema = fuerGeminiSaeubern(
      zodToJsonSchema(o.schema as z.ZodType<unknown>),
    );

    const antwort = await this.anfragen(modell, "generateContent", rumpf, this.frist(o));
    const daten = (await antwort.json()) as GeminiAntwort;

    const text = (daten.candidates?.[0]?.content?.parts ?? [])
      .map((t) => t.text ?? "")
      .join("");

    if (!text.trim()) {
      /*
       * Leer heisst meist: Die Antwort wurde von einem Filter
       * gestoppt. Das als leeres Objekt durchzureichen ergäbe eine
       * Zod-Meldung über fehlende Felder — und die schickt jemanden
       * auf die Suche nach einem Fehler im Schema.
       */
      throw new Error(
        `Google lieferte keinen Text (finishReason: ${daten.candidates?.[0]?.finishReason ?? "unbekannt"}).`,
      );
    }

    return {
      data: o.schema.parse(JSON.parse(text)),
      usage: {
        inputTokens: daten.usageMetadata?.promptTokenCount ?? null,
        outputTokens: daten.usageMetadata?.candidatesTokenCount ?? null,
        model: modell, provider: this.name, latencyMs: Date.now() - beginn,
      },
      rationale: null,
    };
  }

  /* ── Was dieser Adapter nicht tut ──────────────────────────── */

  embed(): Promise<number[][]> {
    /* Siehe Kopf: Ein Wechsel des Einbettungsmodells macht den
       gespeicherten Bestand unbrauchbar. */
    throw new AiCapabilityError(this.name, "embed");
  }

  transcribe(): AsyncIterable<TranscriptChunk> {
    throw new AiCapabilityError(this.name, "transcribe");
  }

  synthesize(): Promise<ArrayBuffer> {
    throw new AiCapabilityError(this.name, "synthesize");
  }
}

/**
 * Server-Sent Events lesen.
 *
 * Die Zeilen kommen nicht sauber an Ereignisgrenzen an: Ein `data:`
 * kann über zwei Netzpakete verteilt sein. Deshalb wird gepuffert und
 * erst bei einem Zeilenumbruch zerlegt — ohne den Puffer bricht jedes
 * längere Ereignis das JSON in der Mitte durch.
 */
export async function* sseLesen(antwort: Response): AsyncIterable<GeminiAntwort> {
  const leser = antwort.body?.getReader();
  if (!leser) return;

  const dekoder = new TextDecoder();
  let puffer = "";

  while (true) {
    const { done, value } = await leser.read();
    if (done) break;
    puffer += dekoder.decode(value, { stream: true });

    const zeilen = puffer.split("\n");
    /* Die letzte Zeile kann unvollständig sein — sie bleibt im Puffer. */
    puffer = zeilen.pop() ?? "";

    for (const zeile of zeilen) {
      if (!zeile.startsWith("data:")) continue;
      const nutzlast = zeile.slice(5).trim();
      if (!nutzlast || nutzlast === "[DONE]") continue;
      try {
        yield JSON.parse(nutzlast) as GeminiAntwort;
      } catch {
        /* Ein unvollständiges Stück überspringen statt den ganzen
           Strom abzubrechen. */
      }
    }
  }
}
