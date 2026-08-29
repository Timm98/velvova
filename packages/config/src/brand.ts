import { currentEnv } from "./env.ts";

/**
 * Marke und Assistenzname. Beide Namen sind vorläufig und koennen sich
 * ändern, deshalb steht hier die einzige Quelle der Wahrheit. Kein
 * anderer Teil des Codes darf "Paycheck" oder "Nina" hart schreiben.
 */

export interface BrandConfig {
  /** Produktname, z. B. in Titeln und Navigation. */
  readonly name: string;
  /** Name der Karriereassistenz. */
  readonly assistantName: string;
  /** Kurzform für enge Stellen wie das Favicon-Wort oder Mobile-Header. */
  readonly shortName: string;
  /** Ein Satz, der das Produkt beschreibt. Wird in Metadaten verwendet. */
  readonly tagline: { de: string; en: string };
  /** Rechtlicher Betreiber. Leer, solange nicht entschieden. */
  readonly legalEntity: string;
  readonly supportEmail: string;
}

function envOr(key: string, fallback: string): string {
  const fromProcess = currentEnv()[key];
  const value = fromProcess?.trim();
  return value && value.length > 0 ? value : fallback;
}

export const brand: BrandConfig = {
  name: envOr("NEXT_PUBLIC_BRAND_NAME", "Paycheck"),
  assistantName: envOr("NEXT_PUBLIC_ASSISTANT_NAME", "Nina"),
  shortName: envOr("NEXT_PUBLIC_BRAND_SHORT_NAME", envOr("NEXT_PUBLIC_BRAND_NAME", "Paycheck")),
  tagline: {
    de: "Finde nicht irgendeinen Job. Finde den, der wirklich zu dir passt.",
    en: "Don't find just any job. Find the one that actually fits.",
  },
  legalEntity: envOr("NEXT_PUBLIC_LEGAL_ENTITY", ""),
  supportEmail: envOr("NEXT_PUBLIC_SUPPORT_EMAIL", "support@example.invalid"),
};


/** Ersetzt {brand} und {assistant} in uebersetzten Texten. */
export function withBrand(template: string, b: BrandConfig = brand): string {
  return template.replace(/\{brand\}/g, b.name).replace(/\{assistant\}/g, b.assistantName);
}
