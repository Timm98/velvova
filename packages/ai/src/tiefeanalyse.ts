import type { z } from "zod";
import type { AiProvider } from "./provider.ts";
import { modellFuer, ultraVerfuegbar } from "./modelle.ts";
import { eskalieren, route, type AiTask, type Aufgabenlast } from "./router.ts";
import { zweiteMeinung, type Vergleichsbefund } from "./zweitemeinung.ts";
import type { RuntimeConfig } from "@paycheck/config";

/**
 * Eine strukturierte Tiefenanalyse — mit zweiter Meinung, wenn nötig.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das eine eigene Naht ist
 * ══════════════════════════════════════════════════════════════
 *
 * Die zweite Meinung ist gebaut und geprüft. Ohne eine Stelle, an der
 * eine Aufgabe sie anfordern kann, bliebe sie das, was in diesem
 * Projekt schon dreimal passiert ist: fertig, dokumentiert, nie
 * aufgerufen.
 *
 * Diese Funktion ist die Stelle. Wer eine tiefe Analyse braucht, ruft
 * sie hier auf und bekommt die Eskalation, den Modellwechsel und die
 * Gegenprüfung, ohne sie selbst zu verdrahten.
 *
 * ══════════════════════════════════════════════════════════════
 * Was sie NICHT tut
 * ══════════════════════════════════════════════════════════════
 *
 * Sie entscheidet nicht, welches Ergebnis stimmt. Gehen die beiden
 * Läufe auseinander, kommen beide zurück, und der Aufrufer bekommt
 * einen Satz, den er der Person zeigen kann.
 *
 * Und sie fordert die höchste Stufe nicht von sich aus an. Ohne
 * eingerichtetes Ultra-Modell läuft genau ein Durchgang — wie bisher.
 */

export interface Tiefenauftrag<T> {
  cfg: RuntimeConfig;
  provider: AiProvider;
  /** Welche Aufgabe — bestimmt Stufe und Zeitgrenze. */
  aufgabe: AiTask;
  /** Die Anweisung an das Modell. */
  anweisung: string;
  /**
   * Die Fakten.
   *
   * Ein einziger Text, weil die zweite Analyse GENAU denselben
   * bekommen muss. Zwei Aufrufer, die je ihre eigene Eingabe bauen,
   * hätten irgendwann zwei verschiedene — und dann verglichen wir
   * Antworten auf verschiedene Fragen.
   */
  fakten: string;
  schema: z.ZodType<T>;
  schemaName: string;
  /** Die Merkmale, die über eine Eskalation entscheiden. */
  last?: Aufgabenlast;
  /** Wie sicher das Ergebnis ist — aus dem Ergebnis selbst gelesen. */
  konfidenzAus?: (ergebnis: T) => number | undefined;
  signal?: AbortSignal;
}

export interface Tiefenbefund<T> extends Vergleichsbefund<T> {
  /** Welches Modell die erste Analyse gerechnet hat. */
  modell: string;
  /** Welches die zweite — `null`, wenn keine lief. */
  zweitmodell: string | null;
  msGesamt: number;
}

export async function tiefeAnalyse<T>(auftrag: Tiefenauftrag<T>): Promise<Tiefenbefund<T>> {
  const start = Date.now();
  const entscheidung = route(auftrag.aufgabe);
  const wahl = modellFuer(auftrag.cfg, entscheidung.tier === "DEEP" ? "DEEP" : "DEFAULT");

  const lauf = async (fakten: string, tier: "deep" | "interactive"): Promise<T> => {
    const a = await auftrag.provider.structuredGenerate<T>({
      system: auftrag.anweisung,
      messages: [{ role: "user", content: fakten }],
      schema: auftrag.schema,
      schemaName: auftrag.schemaName,
      tier,
      temperature: 0,
      timeoutMs: entscheidung.timeoutMs,
      ...(auftrag.signal ? { signal: auftrag.signal } : {}),
    });
    return a.data;
  };

  const erst = await lauf(auftrag.fakten, entscheidung.tier === "DEEP" ? "deep" : "interactive");
  const konfidenz = auftrag.konfidenzAus?.(erst);

  /*
   * Die zweite Analyse läuft mit dem Ultra-Modell.
   *
   * Der Anbieter kennt keine Ultra-Stufe — er kennt `deep`. Deshalb
   * bekommt er hier einen eigenen Aufruf mit dem Ultra-Modell im
   * Namen. Das ist die eine Stelle, an der ein Modellname den Weg
   * durch die Stufen verlässt, und sie steht hier, damit sie nicht
   * überall steht.
   */
  const ultra = modellFuer(auftrag.cfg, "ULTRA");
  const zweitlauf = async (fakten: string): Promise<T> => {
    const a = await auftrag.provider.structuredGenerate<T>({
      system: auftrag.anweisung,
      messages: [{ role: "user", content: fakten }],
      schema: auftrag.schema,
      schemaName: auftrag.schemaName,
      tier: "deep",
      temperature: 0,
      timeoutMs: ultra.timeoutMs,
      modell: ultra.modell,
      ...(auftrag.signal ? { signal: auftrag.signal } : {}),
    });
    return a.data;
  };

  const vergleich = await zweiteMeinung<T>({
    fakten: auftrag.fakten,
    erst,
    konfidenz,
    last: auftrag.last,
    entscheidung,
    zweitlauf,
    ultraVerfuegbar: ultraVerfuegbar(auftrag.cfg),
  });

  return {
    ...vergleich,
    modell: wahl.modell,
    zweitmodell: vergleich.zweitLief ? ultra.modell : null,
    msGesamt: Date.now() - start,
  };
}

/** Ob eine Aufgabe überhaupt eskalieren könnte — ohne sie auszuführen. */
export function koennteEskalieren(
  cfg: RuntimeConfig,
  aufgabe: AiTask,
  last: Aufgabenlast,
): boolean {
  return ultraVerfuegbar(cfg) && eskalieren(route(aufgabe), last).eskaliert;
}
