import type { AiProvider } from "../provider.ts";
import type { Anbieter, Modelldefinition } from "./katalog.ts";
import { ANBIETER_MIT_ADAPTER, type Umgebung } from "./registry.ts";

/**
 * ══════════════════════════════════════════════════════════════════
 * Ein Anbieter je Modell — statt einem Anbieter für alles
 * ══════════════════════════════════════════════════════════════════
 *
 * `factory.ts` liest `AI_PROVIDER`, wählt daraus EINEN Anbieter und
 * gibt ihn für jede Aufgabe zurück. Innerhalb dieses einen Anbieters
 * gibt es Stufen — fast, interactive, deep —, die auf drei Modelle
 * zeigen.
 *
 * Das ist der Grund, warum Monday heute nicht Claude für Unterlagen
 * und GPT für Abwägungen nehmen kann. Nicht der Router: der ist da und
 * kann es. Es steht schlicht nur ein Anbieter hinter ihm.
 *
 * Diese Datei dreht das um. Sie nimmt einen Katalogeintrag und baut
 * den Adapter, der genau dieses Modell anspricht.
 *
 * ── Der Trick, mit dem das ohne Umbau der Adapter geht ──────────
 *
 * Beide vorhandenen Adapter wählen ihr Modell über die Stufe:
 *
 *     model(tier) {
 *       if (tier === "fast") return this.options.modelFast;
 *       if (tier === "deep") return this.options.modelDeep;
 *       return this.options.modelInteractive;
 *     }
 *
 * Stehen in allen drei Feldern dieselbe Kennung, ist die Stufe
 * wirkungslos und der Adapter an ein Modell gebunden — egal, was der
 * Aufrufer als Stufe mitschickt. Keine Zeile in `anthropic.ts` oder
 * `openai.ts` muss dafür angefasst werden.
 *
 * ── Warum hier KEIN Ersatzmodell eingetragen wird ───────────────
 *
 * `OpenAiOptions` kennt `modelInteractiveFallback` und Geschwister:
 * Fällt das Modell aus, springt ein anderes ein. Für einen Aufruf,
 * den jemand ausdrücklich diesem Modell gegeben hat, wäre genau das
 * falsch — er bekäme eine Antwort von einem Modell, das er nicht
 * gewählt hat, und niemand würde es ihm sagen.
 *
 * Ein Ausfall bleibt hier ein Ausfall. Wer ausweichen will, tut es
 * eine Ebene höher, wo `definition.ersatz` steht und die Entscheidung
 * protokolliert werden kann.
 */

export class ModellNichtVerfuegbarError extends Error {
  constructor(
    readonly internId: string,
    readonly grund: string,
  ) {
    super(`Modell ${internId} ist nicht verfügbar: ${grund}`);
    this.name = "ModellNichtVerfuegbarError";
  }
}

const SCHLUESSELNAME: Record<Anbieter, keyof Umgebung> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GEMINI_API_KEY",
};

/** Was gebraucht wird, um dieses Modell anzusprechen. */
export interface Adapterplan {
  anbieter: Anbieter;
  apiModellId: string;
  schluesselname: keyof Umgebung;
  schluessel: string;
}

/**
 * Prüfen, ob und womit dieses Modell erreichbar wäre.
 *
 * Getrennt vom Bauen des Adapters, weil das Bauen ein Anbieter-SDK
 * lädt und einen HTTP-Client aufmacht. Diese Funktion tut nichts
 * davon — sie ist deshalb prüfbar, und die Fehlermeldungen sind es
 * auch.
 */
export function adapterplan(
  definition: Modelldefinition,
  env: Umgebung = process.env as Umgebung,
): Adapterplan {
  if (!ANBIETER_MIT_ADAPTER.has(definition.anbieter)) {
    throw new ModellNichtVerfuegbarError(
      definition.internId,
      `Für ${definition.anbieter} gibt es keinen Adapter in packages/ai/src/providers/.`,
    );
  }

  const schluesselname = SCHLUESSELNAME[definition.anbieter];
  const schluessel = env[schluesselname]?.trim();
  if (!schluessel) {
    /*
     * Der Name der Variablen gehört in die Meldung, ihr Wert nie.
     * Diese Meldung landet in Protokollen.
     */
    throw new ModellNichtVerfuegbarError(
      definition.internId,
      `Kein Schlüssel gesetzt (${schluesselname}).`,
    );
  }

  return {
    anbieter: definition.anbieter,
    apiModellId: definition.apiModellId,
    schluesselname,
    schluessel,
  };
}

export interface Adapterrahmen {
  maxTokens: number;
  timeoutMs: number;
}

/*
 * Ein Adapter je Modell, nicht je Aufruf.
 *
 * Jeder Adapter hält einen HTTP-Client mit eigenem Verbindungspool.
 * Bei jeder Anfrage einen neuen zu bauen hiesse, für jede Nachricht
 * eine neue TLS-Verbindung aufzumachen.
 *
 * Der Schlüssel des Zwischenspeichers enthält den Rahmen mit, weil
 * `timeoutMs` in den Client geht: Zwei Aufrufer mit verschiedenen
 * Fristen dürfen sich keinen Client teilen, dessen Frist von dem
 * stammt, der zuerst da war.
 */
const zwischenspeicher = new Map<string, AiProvider>();

/**
 * Den Adapter für genau dieses Modell holen.
 *
 * Wirft `ModellNichtVerfuegbarError`, wenn Adapter oder Schlüssel
 * fehlen. Die aufrufende Stelle entscheidet, ob sie ausweicht oder
 * die Sache abbricht — hier wird nichts stillschweigend ersetzt.
 */
export async function anbieterFuerModell(
  definition: Modelldefinition,
  rahmen: Adapterrahmen,
  env: Umgebung = process.env as Umgebung,
): Promise<AiProvider> {
  const plan = adapterplan(definition, env);

  const kennung = `${definition.internId}:${rahmen.maxTokens}:${rahmen.timeoutMs}`;
  const bekannt = zwischenspeicher.get(kennung);
  if (bekannt) return bekannt;

  /* Alle drei Stufen auf dasselbe Modell: Die Stufe wird wirkungslos. */
  const gebunden = {
    modelInteractive: plan.apiModellId,
    modelDeep: plan.apiModellId,
    modelFast: plan.apiModellId,
    maxTokens: rahmen.maxTokens,
    timeoutMs: rahmen.timeoutMs,
  };

  let adapter: AiProvider;
  if (plan.anbieter === "anthropic") {
    const { AnthropicProvider } = await import("../providers/anthropic.ts");
    adapter = new AnthropicProvider({ apiKey: plan.schluessel, ...gebunden });
  } else if (plan.anbieter === "google") {
    const { GeminiProvider } = await import("../providers/gemini.ts");
    adapter = new GeminiProvider({ apiKey: plan.schluessel, ...gebunden });
  } else {
    const { OpenAiProvider } = await import("../providers/openai.ts");
    adapter = new OpenAiProvider({
      apiKey: plan.schluessel,
      ...gebunden,
      /*
       * Einbettungen laufen weiter über die Stufenkonfiguration und
       * nicht über den Katalog: Zwei Einbettungsmodelle haben
       * verschiedene Dimensionen, und ihre Vektoren sind nicht
       * vergleichbar. Ein Modellwechsel dort macht gespeicherte
       * Vektoren unbrauchbar, ohne dass irgendwo ein Fehler steht.
       *
       * Ein gebundener Adapter ist zum Reden da, nicht zum Einbetten.
       */
      modelEmbed: "nicht-fuer-einbettungen",
      /* Kein Ersatz. Siehe Kopf dieser Datei. */
    });
  }

  zwischenspeicher.set(kennung, adapter);
  return adapter;
}

/** Für Tests und für einen Konfigurationswechsel im Betrieb. */
export function adapterspeicherLeeren(): void {
  zwischenspeicher.clear();
}
