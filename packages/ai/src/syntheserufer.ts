import { kostenCent, type Preistafel } from "./preise.ts";
import { PROFILSYNTHESE_ANWEISUNG, ProfilsyntheseSchema } from "./prompts/profilsynthese.ts";
import type { AiProvider } from "./provider.ts";

/**
 * Der Modellaufruf für eine Profilsynthese — an einer Stelle.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das hier steht und nicht bei den Aufrufern
 * ══════════════════════════════════════════════════════════════
 *
 * Es gibt zwei: den Arbeiter (`apps/worker`) für die Entwicklung und
 * den internen Endpunkt (`apps/web`) für den Betrieb. Beide brauchen
 * denselben Prompt, dasselbe Schema, dieselbe Stufe und dieselbe
 * Kostenrechnung.
 *
 * Zweimal geschrieben wären sie einmal geändert und einmal
 * vergessen — und dann rechnete der Betrieb mit einem anderen Prompt
 * als die Entwicklung, ohne dass es jemandem auffiele.
 *
 * `packages/jobs` bekommt diese Funktion als Rückruf übergeben und
 * kennt weiterhin keinen Anbieter. Das ist Absicht: Die
 * Fälligkeitsregeln müssen ohne Netz testbar bleiben.
 */
export interface Syntheseantwort {
  ergebnis: Record<string, unknown>;
  modell: string;
  konfidenz: number;
  kostenCent: number;
}

export function profilsyntheseRufer(
  provider: AiProvider,
  tafel: Preistafel,
  hinterlegt: boolean,
): (fakten: string) => Promise<Syntheseantwort> {
  return async (fakten: string) => {
    const a = await provider.structuredGenerate({
      system: PROFILSYNTHESE_ANWEISUNG,
      schema: ProfilsyntheseSchema,
      schemaName: "profilsynthese",
      messages: [{ role: "user", content: fakten }],
      /*
       * DEEP, nicht ULTRA.
       *
       * Eine zweite Meinung entsteht nur in der Karriereanalyse und
       * nur bei zwei gleichzeitigen Auffälligkeiten. Eine Synthese
       * fasst Belege zusammen; sie fällt kein Urteil über einen
       * Lebensweg.
       */
      tier: "deep",
      temperature: 0,
    });

    const k = kostenCent(
      a.usage.inputTokens ?? null,
      a.usage.outputTokens ?? null,
      tafel,
      hinterlegt,
    );

    return {
      ergebnis: a.data as Record<string, unknown>,
      modell: a.usage.model,
      konfidenz: typeof a.data.confidence === "number" ? a.data.confidence : 0.5,
      kostenCent: k.cent,
    };
  };
}
