/**
 * Plattformunabhaengige Darstellungsregeln.
 *
 * Hier stehen bewusst KEINE React-Komponenten: Web und native App
 * rendern mit verschiedenen Bausteinen, und eine gemeinsame Komponente
 * waere in beiden Welten ein Kompromiss. Geteilt wird stattdessen das,
 * was tatsaechlich identisch sein muss - die Entscheidungen darueber,
 * WIE etwas dargestellt wird.
 */

export type Tone = "neutral" | "positive" | "caution" | "critical" | "assistant" | "accent";

/**
 * Welcher Ton gehoert zu einem Zustand?
 *
 * An einer Stelle festgelegt, damit "abgelehnt" nicht auf einer Seite
 * grau und auf einer anderen rot erscheint.
 */
export function toneForApplicationStage(stage: string): Tone {
  switch (stage) {
    case "offer":
    case "accepted":
      return "positive";
    case "interview":
      return "accent";
    case "rejected":
    case "withdrawn":
      return "neutral";
    default:
      return "assistant";
  }
}

export function toneForConstraintVerdict(verdict: string): Tone {
  if (verdict === "eligible") return "positive";
  if (verdict === "blocked") return "critical";
  return "neutral";
}

export function toneForClaimStatus(status: string): Tone {
  if (status === "supported") return "positive";
  if (status === "weakened") return "caution";
  return "critical";
}

/**
 * Wie viel Text passt in eine Karte, bevor gekuerzt wird?
 * Bewusst grosszuegig: eine mitten im Satz abgeschnittene Erfahrung
 * wirkt wie ein Fehler.
 */
export const TRUNCATE = { cardStatement: 120, listItem: 90, badge: 32 } as const;

export function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;

  // An der letzten Wortgrenze kuerzen. Nur wenn im ganzen Ausschnitt
  // kein Leerzeichen steht - ein einzelnes sehr langes Wort - wird hart
  // geschnitten. Eine Schwelle wie "mindestens 60 Prozent" war hier
  // falsch: bei kurzen Grenzen schnitt sie doch mitten im Wort.
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

/** Beruehrungsziele nach WCAG 2.2: mindestens 24, angenehm ab 44. */
export const TOUCH_TARGET = { minimum: 24, comfortable: 44 } as const;

/** Die Breitenpunkte, gegen die getestet wird. */
export const BREAKPOINTS = { narrow: 360, phone: 390, tablet: 768, laptop: 1024, desktop: 1440 } as const;

export { darkTokens, lightTokens, radius, space, type Tokens } from "@paycheck/design-tokens";
