import { loadRuntimeConfig, type RuntimeConfig } from "@paycheck/config";
import type { AiProvider } from "./provider.ts";
import { MockAiProvider } from "./providers/mock.ts";

/**
 * Anbieterauswahl.
 *
 * Grundsatz: ein Anbieter gilt nur als verfügbar, wenn er wirklich
 * benutzbar ist. Wer AI_PROVIDER=openai setzt, aber keinen Schlüssel
 * hinterlegt, bekommt den lokalen Anbieter und einen klaren Grund —
 * nicht einen Fehler beim ersten Klick und vor allem nicht die Illusion
 * echten Betriebs.
 *
 * Der Rückfall ist nirgends still: `fallbackReason` wird in der
 * Oberfläche angezeigt, und der lokale Anbieter kennzeichnet seine
 * Antworten selbst als Beispiele.
 */

export interface ProviderSelection {
  provider: AiProvider;
  /** Wurde der gewünschte Anbieter tatsächlich verwendet? */
  usingRequested: boolean;
  /** Verständlicher Grund, falls nicht. Wird in der Oberfläche gezeigt. */
  fallbackReason: string | null;
  /** Name der fehlenden Umgebungsvariablen — nie ihr Wert. */
  missingVariable?: string;
}

let cached: ProviderSelection | undefined;

function missingKey(envName: string): ProviderSelection {
  return {
    provider: new MockAiProvider(),
    usingRequested: false,
    // Der Name der fehlenden Variablen, nie ihr Wert. Diese Zeichenkette
    // landet in der Oberfläche.
    missingVariable: envName,
    fallbackReason:
      `Es ist kein Zugangsschlüssel hinterlegt (${envName}). Es läuft der lokale Demo-Anbieter; ` +
      `die Antworten sind Beispiele ohne inhaltliche Aussage.`,
  };
}

/**
 * Darf der Demo-Anbieter überhaupt antworten?
 *
 * In der Entwicklung ja — sonst könnte niemand ohne Schlüssel am
 * Produkt arbeiten, und die Bewertungslogik braucht ohnehin kein
 * Modell.
 *
 * In Produktion nein. Eine Beispielantwort, die aussieht wie eine
 * Antwort von Nina, ist eine Lüge über das, was das Produkt gerade
 * kann — und die teuerste Sorte Lüge, weil die Person darauf
 * Entscheidungen über ihre Bewerbung stützt.
 *
 * Statt einer erfundenen Antwort kommt dann ein ehrlicher Fehler.
 */
export function mockAllowed(cfg: RuntimeConfig = loadRuntimeConfig()): boolean {
  return cfg.nodeEnv !== "production" && cfg.appEnv !== "production";
}

export class AiNotConfiguredError extends Error {
  readonly missingVariable: string;

  constructor(missingVariable: string) {
    super(
      `Die KI-Verbindung ist nicht eingerichtet: ${missingVariable} fehlt. ` +
        "Es wird keine Beispielantwort ausgegeben — sie wäre von einer echten Antwort " +
        "nicht zu unterscheiden.",
    );
    this.name = "AiNotConfiguredError";
    this.missingVariable = missingVariable;
  }
}

export async function selectProvider(
  cfg: RuntimeConfig = loadRuntimeConfig(),
): Promise<ProviderSelection> {
  if (cached) return cached;

  if (cfg.ai.provider === "openai" || cfg.ai.provider === "self_hosted") {
    const envName = cfg.ai.provider === "openai" ? "OPENAI_API_KEY" : "SELF_HOSTED_API_KEY";

    if (!cfg.ai.apiKey) {
      cached = missingKey(envName);
      return cached;
    }
    if (cfg.ai.provider === "self_hosted" && !cfg.ai.baseUrl) {
      cached = {
        provider: new MockAiProvider(),
        usingRequested: false,
        fallbackReason:
          "SELF_HOSTED_BASE_URL fehlt. Ohne Adresse gibt es keinen Endpunkt, den man ansprechen " +
          "könnte; es läuft der lokale Demo-Anbieter.",
      };
      return cached;
    }

    const { OpenAiProvider } = await import("./providers/openai.ts");
    cached = {
      provider: new OpenAiProvider({
        apiKey: cfg.ai.apiKey,
        baseUrl: cfg.ai.baseUrl,
        modelInteractive: cfg.ai.modelInteractive,
        modelDeep: cfg.ai.modelDeep,
        modelFast: cfg.ai.modelFast,
        modelEmbed: cfg.ai.modelEmbed,
        maxTokens: cfg.ai.maxTokensPerRun,
        timeoutMs: cfg.ai.timeoutMs,
        transcribeModel: cfg.ai.modelTranscribe,
        speechModel: cfg.ai.modelSpeech,
        speechVoice: cfg.ai.speechVoice,
      }),
      usingRequested: true,
      fallbackReason: null,
    };
    return cached;
  }

  if (cfg.ai.provider === "anthropic") {
    if (!cfg.ai.apiKey) {
      cached = missingKey("ANTHROPIC_API_KEY");
      return cached;
    }
    const { AnthropicProvider } = await import("./providers/anthropic.ts");
    cached = {
      provider: new AnthropicProvider({
        apiKey: cfg.ai.apiKey,
        modelInteractive: cfg.ai.modelInteractive,
        modelDeep: cfg.ai.modelDeep,
        modelFast: cfg.ai.modelFast,
        maxTokens: cfg.ai.maxTokensPerRun,
        timeoutMs: cfg.ai.timeoutMs,
      }),
      usingRequested: true,
      fallbackReason: null,
    };
    return cached;
  }

  cached = { provider: new MockAiProvider(), usingRequested: true, fallbackReason: null };
  return cached;
}

/** Für Tests. */
export function resetProviderCache(): void {
  cached = undefined;
}
