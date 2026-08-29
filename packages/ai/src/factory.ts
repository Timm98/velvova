import { loadRuntimeConfig, type RuntimeConfig } from "@paycheck/config";
import type { AiProvider } from "./provider.ts";
import { MockAiProvider } from "./providers/mock.ts";

/**
 * Anbieterauswahl.
 *
 * Grundsatz: ein Anbieter gilt nur als verfuegbar, wenn er wirklich
 * benutzbar ist. Wer AI_PROVIDER=anthropic setzt, aber keinen Schluessel
 * hinterlegt, bekommt den lokalen Anbieter und einen Hinweis - nicht
 * einen Fehler beim ersten Klick und nicht die Illusion echten Betriebs.
 */

export interface ProviderSelection {
  provider: AiProvider;
  /** Wurde der gewuenschte Anbieter tatsaechlich verwendet? */
  usingRequested: boolean;
  /** Verstaendlicher Grund, falls nicht. Wird in der Oberflaeche gezeigt. */
  fallbackReason: string | null;
}

let cached: ProviderSelection | null = null;

export async function selectProvider(cfg: RuntimeConfig = loadRuntimeConfig()): Promise<ProviderSelection> {
  if (cached) return cached;

  if (cfg.ai.provider === "anthropic") {
    if (!cfg.ai.apiKey) {
      cached = {
        provider: new MockAiProvider(),
        usingRequested: false,
        fallbackReason:
          "Es ist kein Zugangsschluessel hinterlegt. Es laeuft der lokale Demo-Anbieter; " +
          "die Antworten sind Beispiele ohne inhaltliche Aussage.",
      };
      return cached;
    }
    const { AnthropicProvider } = await import("./providers/anthropic.ts");
    cached = {
      provider: new AnthropicProvider({
        apiKey: cfg.ai.apiKey,
        modelStrong: cfg.ai.modelStrong,
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

/** Fuer Tests. */
export function resetProviderCache(): void {
  cached = null;
}
