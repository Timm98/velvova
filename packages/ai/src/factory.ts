import { loadRuntimeConfig, type RuntimeConfig } from "@paycheck/config";
import type { AiProvider } from "./provider.ts";

/**
 * Anbieterauswahl.
 *
 * Es gibt genau zwei Ausgänge: einen echten Anbieter oder einen Fehler.
 * Einen dritten — die Beispielantwort — gab es hier einmal, und er war
 * der gefährlichste von allen: eine erfundene Antwort ist von einer
 * echten nicht zu unterscheiden, und die Person stützt Entscheidungen
 * über ihre Bewerbung darauf.
 *
 * Der lokale Anbieter lebt weiter in `providers/mock.ts`, aber nur noch
 * für Tests. Aus dieser Datei ist er verschwunden, damit ihn kein
 * Produktionspfad mehr versehentlich erreichen kann.
 */

export class AiNotConfiguredError extends Error {
  /** Name der fehlenden Variablen — nie ihr Wert. */
  readonly missingVariable: string;

  constructor(missingVariable: string) {
    super(`Die KI-Verbindung ist nicht eingerichtet: ${missingVariable} fehlt.`);
    this.name = "AiNotConfiguredError";
    this.missingVariable = missingVariable;
  }
}

/**
 * Fehlt etwas, bevor überhaupt ein Aufruf startet?
 *
 * Für Oberflächen, die den Zustand anzeigen wollen, ohne einen Fehler
 * auszulösen. Gibt den NAMEN der fehlenden Variablen zurück, nie ihren
 * Wert.
 */
export function aiConfigurationProblem(
  cfg: RuntimeConfig = loadRuntimeConfig(),
): { missingVariable: string } | null {
  switch (cfg.ai.provider) {
    case "openai":
      return cfg.ai.apiKey ? null : { missingVariable: "OPENAI_API_KEY" };
    case "anthropic":
      return cfg.ai.apiKey ? null : { missingVariable: "ANTHROPIC_API_KEY" };
    case "self_hosted":
      if (!cfg.ai.apiKey) return { missingVariable: "SELF_HOSTED_API_KEY" };
      return cfg.ai.baseUrl ? null : { missingVariable: "SELF_HOSTED_BASE_URL" };
    default:
      // "mock" oder gar nichts. Beides heißt: es ist kein Anbieter
      // eingerichtet. Früher lief hier still der Demo-Anbieter an.
      return { missingVariable: "AI_PROVIDER" };
  }
}

export function isAiConfigured(cfg: RuntimeConfig = loadRuntimeConfig()): boolean {
  return aiConfigurationProblem(cfg) === null;
}

let cached: { key: string; provider: AiProvider } | undefined;

/**
 * Den Anbieter holen.
 *
 * Wirft `AiNotConfiguredError`, wenn nichts eingerichtet ist. Die
 * aufrufende Stelle entscheidet dann über die Meldung — in der
 * Entwicklung anders formuliert als in Produktion, aber in beiden
 * Fällen ehrlich.
 */
export async function selectProvider(
  cfg: RuntimeConfig = loadRuntimeConfig(),
): Promise<AiProvider> {
  const problem = aiConfigurationProblem(cfg);
  if (problem) throw new AiNotConfiguredError(problem.missingVariable);

  // Der Zwischenspeicher hängt am Anbieter und am Modell, nicht nur am
  // Vorhandensein. Sonst überlebt eine alte Auswahl eine geänderte
  // Konfiguration.
  const key = `${cfg.ai.provider}:${cfg.ai.modelInteractive}:${cfg.ai.baseUrl ?? ""}`;
  if (cached?.key === key) return cached.provider;

  if (cfg.ai.provider === "anthropic") {
    const { AnthropicProvider } = await import("./providers/anthropic.ts");
    cached = {
      key,
      provider: new AnthropicProvider({
        apiKey: cfg.ai.apiKey!,
        modelInteractive: cfg.ai.modelInteractive,
        modelDeep: cfg.ai.modelDeep,
        modelFast: cfg.ai.modelFast,
        maxTokens: cfg.ai.maxTokensPerRun,
        timeoutMs: cfg.ai.timeoutMs,
      }),
    };
    return cached.provider;
  }

  const { OpenAiProvider } = await import("./providers/openai.ts");
  cached = {
    key,
    provider: new OpenAiProvider({
      apiKey: cfg.ai.apiKey!,
      baseUrl: cfg.ai.baseUrl,
      modelInteractive: cfg.ai.modelInteractive,
      modelDeep: cfg.ai.modelDeep,
      modelFast: cfg.ai.modelFast,
      modelEmbed: cfg.ai.modelEmbed,
      /*
       * Die Ersatzmodelle bis hierher durchreichen.
       *
       * Ohne diese vier Zeilen stünde die Ersatzlogik im Anbieter da
       * und bekäme nie ein Modell zu sehen — gebaut, geprüft, nie
       * angeschlossen. Dieselbe Sorte Fehler, die `job_alarme` und
       * `ai_runs` monatelang leer liess.
       */
      modelInteractiveFallback: cfg.ai.modelInteractiveFallback,
      modelDeepFallback: cfg.ai.modelDeepFallback,
      modelFastFallback: cfg.ai.modelFastFallback,
      modelEmbedFallback: cfg.ai.modelEmbedFallback,
      maxTokens: cfg.ai.maxTokensPerRun,
      timeoutMs: cfg.ai.timeoutMs,
      transcribeModel: cfg.ai.modelTranscribe,
      speechModel: cfg.ai.modelSpeech,
      speechVoice: cfg.ai.speechVoice,
    }),
  };
  return cached.provider;
}

/**
 * Die Meldung, die der Person gezeigt wird.
 *
 * Zwei Fassungen, weil zwei verschiedene Menschen sie lesen: in der
 * Entwicklung jemand, der die Variable setzen kann; in Produktion
 * jemand, der nur wissen will, ob seine Daten weg sind.
 */
export function aiUnavailableMessage(
  cfg: RuntimeConfig = loadRuntimeConfig(),
): string {
  const istProduktion = cfg.nodeEnv === "production" || cfg.appEnv === "production";
  return istProduktion
    ? "Nina ist gerade nicht erreichbar. Deine bisherigen Daten sind sicher gespeichert. Versuche es bitte erneut."
    : "Die KI-Verbindung ist noch nicht vollständig konfiguriert.";
}

/** Für Tests. */
export function resetProviderCache(): void {
  cached = undefined;
}
