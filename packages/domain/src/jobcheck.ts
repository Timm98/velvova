import type { Widerspruch } from "./widersprueche.ts";

/**
 * Der Job-Check: soll ich diesen Job annehmen?
 *
 * ── Warum das etwas anderes ist als „soll ich mich bewerben" ──
 *
 * Vor der Bewerbung kostet ein Irrtum eine Stunde. Vor der Unterschrift
 * kostet er Monate. Die Empfehlung muss deshalb eine andere sein — und
 * sie muss **ablehnen** enthalten.
 *
 * Ein Produkt, das nur „bewirb dich" und „bewirb dich lieber nicht"
 * kennt, hat für die wichtigere Entscheidung keine Sprache.
 *
 * ── Warum Nina auch von Stellen abraten muss, die man bekäme ──
 *
 * Die stärkste Aussage, die dieses Produkt machen kann, ist: „Du
 * könntest diesen Job wahrscheinlich bekommen. Ich glaube trotzdem
 * nicht, dass du ihn annehmen solltest."
 *
 * Sie ist nur möglich, wenn fachliche Eignung und Lebenspassung
 * getrennt betrachtet werden — was der Passungsbefund bereits tut.
 */

export const EMPFEHLUNGEN = ["annehmen", "erst_klaeren", "verhandeln", "ablehnen"] as const;
export type Jobempfehlung = (typeof EMPFEHLUNGEN)[number];

export const EMPFEHLUNGSTEXT: Record<Jobempfehlung, { wort: string; ton: "positive" | "caution" | "critical" }> = {
  annehmen: { wort: "Annehmen", ton: "positive" },
  erst_klaeren: { wort: "Erst klären", ton: "caution" },
  verhandeln: { wort: "Nachverhandeln", ton: "caution" },
  ablehnen: { wort: "Nicht annehmen", ton: "critical" },
};

export interface JobcheckEingabe {
  /** Was für die Stelle spricht — aus dem Passungsbefund. */
  passt: string[];
  /** Was dagegen spricht. Harte Bedingungen und deutliche Achsenabstände. */
  passtNicht: string[];
  /** Was die Anzeige offenlässt. */
  ungeklaert: string[];
  /** Was sich widerspricht. */
  widersprueche: Widerspruch[];
  /**
   * Ob eine harte Bedingung verletzt ist.
   *
   * Kein Punkt unter vielen: Eine verletzte Bedingung ist eine
   * Entscheidung, die der Mensch schon getroffen hat.
   */
  bedingungGebrochen: boolean;
}

export interface Jobcheck extends JobcheckEingabe {
  empfehlung: Jobempfehlung;
  /** Ein Satz. Er trägt die Empfehlung allein. */
  kernsatz: string;
  /** Was NICHT gesagt werden kann. Steht immer dabei. */
  grenzen: string;
}

/**
 * Die Empfehlung — die Reihenfolge ist die Rangfolge.
 *
 * ── Warum ein Widerspruch nicht zum Ablehnen führt ────────────
 *
 * Er führt zum Klären. Ein Widerspruch bedeutet, dass eine der beiden
 * Aussagen falsch ist — nicht, welche. Wer deshalb ablehnt, lehnt
 * womöglich wegen eines Missverständnisses ab.
 *
 * ── Warum eine gebrochene Bedingung sofort zum Ablehnen führt ─
 *
 * Weil der Mensch sie selbst als unverzichtbar bezeichnet hat. Sie
 * gegen eine gute Passung abzuwägen hiesse, seine eigene Entscheidung
 * zu überstimmen.
 */
export function jobcheck(e: JobcheckEingabe): Jobcheck {
  const empfehlung: Jobempfehlung = e.bedingungGebrochen
    ? "ablehnen"
    : e.passtNicht.length >= 3
      ? "ablehnen"
      : e.widersprueche.length > 0
        ? "erst_klaeren"
        : e.ungeklaert.length >= 4
          ? "erst_klaeren"
          : e.passtNicht.length > 0
            ? "verhandeln"
            : "annehmen";

  const kernsatz =
    empfehlung === "ablehnen"
      ? e.bedingungGebrochen
        ? `Diese Stelle verletzt eine Bedingung, die du als unverzichtbar bezeichnet hast: ${e.passtNicht[0] ?? "sie ist nicht erfüllt"}.`
        : "Du könntest diese Stelle wahrscheinlich bekommen. Nach dem, was du über deine Arbeitsweise gesagt hast, glaube ich trotzdem nicht, dass du sie annehmen solltest."
      : empfehlung === "erst_klaeren"
        ? e.widersprueche.length > 0
          ? `Zu ${e.widersprueche.length === 1 ? "einem Punkt" : `${e.widersprueche.length} Punkten`} liegen zwei verschiedene Aussagen vor. Eine davon stimmt nicht — kläre welche, bevor du unterschreibst.`
          : `${e.ungeklaert.length} wichtige Punkte sind offen. Das ist kein Ausschluss, aber es sind Fragen für das nächste Gespräch.`
        : empfehlung === "verhandeln"
          ? `Der grössere Teil passt. ${e.passtNicht[0]} — darüber würde ich reden, bevor du zusagst.`
          : "Nach allem, was vorliegt, spricht nichts dagegen.";

  return {
    ...e,
    empfehlung,
    kernsatz,
    grenzen:
      "Diese Einschätzung beruht auf dem, was du mir gesagt hast, und auf dem, was in der Anzeige steht. " +
      "Sie kennt weder das Team noch den Vorgesetzten noch den Ton im Haus. " +
      "Sie ersetzt kein Gespräch mit jemandem, der die Stelle macht.",
  };
}
