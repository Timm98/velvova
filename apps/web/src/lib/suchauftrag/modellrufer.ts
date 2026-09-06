import "server-only";
import type { z } from "zod";
import {
  kostenCent,
  MAILTEXT_ANWEISUNG,
  MAILTEXT_PROMPT_FASSUNG,
  MailtextAntwortSchema,
  preistafel,
  selectProvider,
  MATCHING_ANWEISUNG,
  MATCHING_PROMPT_FASSUNG,
  MatchbelegeAntwortSchema,
  SUCHPROFIL_ANWEISUNG,
  SUCHPROFIL_PROMPT_FASSUNG,
  SuchprofilAntwortSchema,
} from "@paycheck/ai";
import { loadRuntimeConfig } from "@paycheck/config";
import { EINBETTUNG_STAPEL } from "@paycheck/jobs";
import type {
  Einbetter,
  Einbettungsmodell,
  Modellergebnis,
  Modellrufer,
  Prompt1,
  Prompt2,
  Prompt3,
} from "@paycheck/jobs";

/**
 * Der Modellaufruf für den Suchauftrag.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum der Adapter hier steht und nicht im Paket
 * ══════════════════════════════════════════════════════════════
 *
 * `@paycheck/jobs` kennt keinen Anbieter. Das ist kein Selbstzweck:
 * Der Hintergrunddienst läuft als Skript, und ein statischer Import
 * des Anbieter-SDK zöge es in jede Testumgebung — auch in die, die
 * nie ein Modell braucht und keinen Schlüssel hat.
 *
 * Der zweite Grund wiegt schwerer: So kann ein Test niemals
 * versehentlich einen kostenpflichtigen Aufruf auslösen. Wer keinen
 * Rufer übergibt, bekommt den deterministischen Weg.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum die Kosten hier berechnet werden
 * ══════════════════════════════════════════════════════════════
 *
 * Weil nur hier bekannt ist, wie viele Tokens verbraucht wurden. Das
 * Budget im Paket zählt über `ai_runs`; ohne eine Zahl in dieser
 * Spalte bliebe die Summe null und die Grenze griffe nie.
 */

export function modellrufer(): Modellrufer | undefined {
  /*
   * Kein Modell heisst kein Rufer — nicht ein Rufer, der scheitert.
   *
   * Der Unterschied steht im Protokoll: „kein_modell" ist ein
   * Betriebszustand, ein Fehlversuch wäre ein Fehler. Beides gleich
   * zu behandeln hiesse, eine fehlende Konfiguration wie einen Ausfall
   * aussehen zu lassen — und dann sucht jemand den Fehler beim
   * Anbieter.
   */
  const tafel = preistafel();

  return async <T>(auftrag: {
    system: string;
    eingabe: string;
    schema: unknown;
    schemaName: string;
    tier: "interactive" | "deep" | "fast";
  }): Promise<Modellergebnis<T>> => {
    const provider = await selectProvider();
    const antwort = await provider.structuredGenerate<T>({
      system: auftrag.system,
      messages: [{ role: "user", content: auftrag.eingabe }],
      schema: auftrag.schema as z.ZodType<T>,
      schemaName: auftrag.schemaName,
      tier: auftrag.tier,
      /*
       * Temperatur 0.
       *
       * Nicht als Versprechen auf identische Texte — das wäre eines,
       * das kein Anbieter hält. Sondern weil es bei einer Mail, die
       * geprüfte Gründe wiedergibt, nichts zu variieren gibt.
       */
      temperature: 0,
    });

    const kosten = kostenCent(
      antwort.usage.inputTokens,
      antwort.usage.outputTokens,
      tafel.tafel,
      tafel.hinterlegt,
    );

    return {
      data: antwort.data,
      usage: {
        inputTokens: antwort.usage.inputTokens,
        outputTokens: antwort.usage.outputTokens,
        model: antwort.usage.model,
        provider: antwort.usage.provider,
        latencyMs: antwort.usage.latencyMs,
        kostenCent: kosten.cent,
      },
    };
  };
}

/** Systemprompt 2 — die Matchingbelege. */
export const PROMPT_MATCHBELEGE: Prompt2 = {
  anweisung: MATCHING_ANWEISUNG,
  schema: MatchbelegeAntwortSchema,
  fassung: MATCHING_PROMPT_FASSUNG,
};

/**
 * Das Einbettungsmodell.
 *
 * Der Name steht im Schlüssel jeder gespeicherten Einbettung: Zwei
 * Vektoren verschiedener Modelle sind nicht vergleichbar, und die
 * Kosinusrechnung sagt trotzdem eine Zahl. Ein Modellwechsel erzeugt
 * damit neue Zeilen statt stillschweigend Unsinn.
 */
export function einbettungsmodell(): Einbettungsmodell {
  return { name: loadRuntimeConfig().ai.modelEmbed, stapel: EINBETTUNG_STAPEL };
}

/**
 * Der Einbetter — oder nichts.
 *
 * Ohne ihn läuft die Suche über Struktur und Stichwort weiter. Das
 * ist weniger Recall, kein Ausfall: „Kommissionierer" bleibt dann
 * unsichtbar für jemanden, der „Lagerhelfer" gesagt hat.
 */
export function einbetter(): Einbetter {
  return async (texte: string[]) => {
    const provider = await selectProvider();
    return provider.embed(texte);
  };
}

/** Systemprompt 1 — aus einem Satz ein Suchauftrag. */
export const PROMPT_SUCHPROFIL: Prompt1 = {
  anweisung: SUCHPROFIL_ANWEISUNG,
  schema: SuchprofilAntwortSchema,
  fassung: SUCHPROFIL_PROMPT_FASSUNG,
};

/** Systemprompt 3, so wie das Paket ihn erwartet. */
export const PROMPT_MAILTEXT: Prompt3 = {
  anweisung: MAILTEXT_ANWEISUNG,
  schema: MailtextAntwortSchema,
  fassung: MAILTEXT_PROMPT_FASSUNG,
};

/**
 * Ob überhaupt ein Modell eingerichtet ist.
 *
 * Getrennt vom Rufer, damit die Antwort des Endpunkts sagen kann,
 * warum deterministisch gerechnet wurde. „Es lief" ohne diese
 * Auskunft wäre die Meldung, hinter der eine fehlende Konfiguration
 * wochenlang unbemerkt bleibt.
 */
export async function modellBereit(): Promise<{ bereit: boolean; grund: string | null }> {
  try {
    await selectProvider();
    return { bereit: true, grund: null };
  } catch (fehler) {
    return {
      bereit: false,
      grund: fehler instanceof Error ? fehler.message.slice(0, 200) : "unbekannt",
    };
  }
}
