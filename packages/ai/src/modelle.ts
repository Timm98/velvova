import type { RuntimeConfig } from "@paycheck/config";

/**
 * Welches Modell wofür — an genau einer Stelle.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum es diese Datei gibt
 * ══════════════════════════════════════════════════════════════
 *
 * Damit nirgends im Code `model: "gpt-5"` steht. Ein Modellname, der
 * an zehn Stellen steht, wird an neun davon vergessen, wenn er sich
 * ändert — und der Fehler zeigt sich erst als 404 in einer Funktion,
 * die seit Monaten läuft.
 *
 * Die Namen kommen aus der Umgebung, die Zuordnung steht hier.
 *
 * ══════════════════════════════════════════════════════════════
 * Was am 6. September 2026 gemessen wurde
 * ══════════════════════════════════════════════════════════════
 *
 * Mit unserem Schlüssel, echte Aufrufe (`scripts/modell-diagnose.mjs`):
 *
 *   Modell           Latenz    Struktur  Werkzeuge
 *   gpt-4.1-mini      479 ms   ja        chat
 *   gpt-5-mini       1842 ms   ja        chat
 *   gpt-5             850 ms   ja        chat
 *   gpt-5.6-sol       851 ms   ja        NUR /v1/responses
 *   gpt-6-astra      1171 ms   ja        NUR /v1/responses
 *
 * Die letzte Spalte ist der Grund für die Aufteilung unten. `sol` und
 * `astra` können Werkzeuge — aber nur über die Responses-Schnittstelle.
 * Unser Anbieter spricht `chat/completions`. Wer sie dort mit
 * Werkzeugen aufruft, bekommt:
 *
 *   „Function tools with reasoning_effort are not supported […]
 *    To use function tools, use /v1/responses."
 *
 * Deshalb: Gespräch und Werkzeuge laufen über die Modelle, die es an
 * unserem Endpunkt können. Analyse — die keine Werkzeuge braucht,
 * sondern strukturierte Ausgaben — darf auf `sol` und `astra`.
 */

export type Modellstufe = "FAST" | "DEFAULT" | "DEEP" | "ULTRA" | "REALTIME" | "EMBEDDING";

export interface Modellwahl {
  /** Das Modell, das gefragt wird. */
  modell: string;
  /** Was einspringt, wenn es ausfällt. `null` heisst: kein Ersatz. */
  ersatz: string | null;
  /** Wie lange gewartet wird, bevor abgebrochen wird. */
  timeoutMs: number;
  /**
   * Ob dieses Modell Werkzeuge NUR über `/v1/responses` kann.
   *
   * ══════════════════════════════════════════════════════════════
   * Warum das für uns folgenlos ist — und trotzdem dasteht
   * ══════════════════════════════════════════════════════════════
   *
   * Unser Anbieter ruft ausschliesslich `/v1/responses` auf; einen
   * `chat.completions`-Aufruf gibt es im ganzen Paket nicht. Für die
   * Zuordnung der Stufen spielt dieses Feld deshalb keine Rolle.
   *
   * Es steht hier, weil die erste Messung an `/chat/completions`
   * lief und für `gpt-5.6-sol` und `gpt-6-astra` ein glattes „kann
   * keine Werkzeuge" ergab. Das war falsch — beide können es, nur
   * nicht dort. Zwei brauchbare Modelle wären daran fast
   * ausgeschieden.
   *
   * Wer später einen zweiten Aufrufweg baut, soll diese Einschränkung
   * vorfinden, statt sie noch einmal zu entdecken.
   */
  werkzeugeNurUeberResponses: boolean;
}

/**
 * Zeitgrenzen je Stufe.
 *
 * ── Warum sie sich unterscheiden ──────────────────────────────
 *
 * Eine Extraktion, die nach fünfzehn Sekunden nicht fertig ist,
 * wird es auch nach neunzig nicht — dort ist etwas kaputt, und ein
 * langes Warten macht aus einem schnellen Fehler einen langsamen.
 *
 * Eine tiefe Analyse dagegen darf dauern. Sie läuft im Hintergrund,
 * und niemand sitzt davor.
 */
const ZEITGRENZE: Record<Modellstufe, number> = {
  FAST: 15_000,
  DEFAULT: 30_000,
  DEEP: 90_000,
  ULTRA: 120_000,
  REALTIME: 30_000,
  EMBEDDING: 30_000,
};

/**
 * Modelle, die Werkzeuge nur über `/v1/responses` annehmen.
 *
 * Gemessen am 6. September 2026:
 *
 *   „Function tools with reasoning_effort are not supported for
 *    gpt-5.6-sol in /v1/chat/completions. To use function tools,
 *    use /v1/responses."
 *
 * Präfixvergleich, damit datierte Fassungen wie
 * `gpt-5.6-sol-2026-…` mitgefasst sind.
 */
const NUR_UEBER_RESPONSES = ["gpt-5.6-", "gpt-6-"];

export function werkzeugeNurUeberResponses(modell: string): boolean {
  return NUR_UEBER_RESPONSES.some((p) => modell.startsWith(p));
}

/**
 * Die Modellwahl für eine Stufe.
 *
 * ── Warum ULTRA auf DEEP zurückfällt ──────────────────────────
 *
 * Weil eine Stufe, die niemand eingerichtet hat, nicht zum Ausfall
 * führen darf. Wer `OPENAI_MODEL_ULTRA_DEEP` nicht setzt, bekommt die
 * tiefe Analyse — schlechter als die höchste Stufe, aber besser als
 * eine Fehlermeldung.
 */
export function modellFuer(cfg: RuntimeConfig, stufe: Modellstufe): Modellwahl {
  const ai = cfg.ai;

  const waehle = (modell: string, ersatz: string | null | undefined): Modellwahl => ({
    modell,
    /* Ein Ersatz, der dasselbe Modell nennt, ist kein Ersatz. */
    ersatz: ersatz && ersatz !== modell ? ersatz : null,
    timeoutMs: ZEITGRENZE[stufe],
    werkzeugeNurUeberResponses: werkzeugeNurUeberResponses(modell),
  });

  switch (stufe) {
    case "FAST":
      return waehle(ai.modelFast, ai.modelFastFallback);
    case "DEFAULT":
      return waehle(ai.modelInteractive, ai.modelInteractiveFallback);
    case "DEEP":
      return waehle(ai.modelDeep, ai.modelDeepFallback);
    case "ULTRA":
      /* Ohne eingerichtete Höchststufe gilt die tiefe. */
      return ai.modelUltraDeep
        ? waehle(ai.modelUltraDeep, ai.modelUltraDeepFallback ?? ai.modelDeep)
        : waehle(ai.modelDeep, ai.modelDeepFallback);
    case "REALTIME":
      return waehle(ai.modelRealtime, null);
    case "EMBEDDING":
      return waehle(ai.modelEmbed, ai.modelEmbedFallback);
  }
}

/**
 * Ob die höchste Stufe überhaupt eingerichtet ist.
 *
 * Getrennt abfragbar, damit ein Aufrufer entscheiden kann, ob sich
 * eine zweite Meinung lohnt — statt sie anzufordern und dieselbe
 * Antwort noch einmal zu bekommen.
 */
export function ultraVerfuegbar(cfg: RuntimeConfig): boolean {
  return Boolean(cfg.ai.modelUltraDeep) && cfg.ai.modelUltraDeep !== cfg.ai.modelDeep;
}

/** Alle eingerichteten Modelle — für Diagnose und Gesundheitsprüfung. */
export function alleModelle(cfg: RuntimeConfig): Record<Modellstufe, string> {
  return {
    FAST: modellFuer(cfg, "FAST").modell,
    DEFAULT: modellFuer(cfg, "DEFAULT").modell,
    DEEP: modellFuer(cfg, "DEEP").modell,
    ULTRA: modellFuer(cfg, "ULTRA").modell,
    REALTIME: modellFuer(cfg, "REALTIME").modell,
    EMBEDDING: modellFuer(cfg, "EMBEDDING").modell,
  };
}
