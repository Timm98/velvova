/**
 * Was Free kann und was Premium kostet.
 *
 * Zwei Pläne, nicht drei. Ein „Premium Plus" wäre eine dritte Spalte in
 * einer Tabelle, die niemand liest, und eine dritte Grenze, die niemand
 * versteht. Es kommt dazu, wenn es einen Grund gibt — nicht auf Verdacht.
 *
 * Die Leitlinie beim Zuschnitt: **Free muss ehrlich nützlich sein.**
 * Wer nicht zahlt, bekommt keine Demoversion, sondern ein kleineres,
 * vollständiges Produkt. Nina führt das Gespräch, findet Stellen,
 * begründet ihre Empfehlungen und bereitet Bewerbungen vor. Premium
 * macht das gleiche tiefer, öfter und in mehr Sprachen.
 *
 * Was ausdrücklich NICHT hinter der Schranke liegt:
 *
 *   - das Karrieregespräch selbst,
 *   - das Sehen von Stellen,
 *   - die Begründung einer Empfehlung,
 *   - das Vorbereiten einer Bewerbung,
 *   - der eigene Datenexport.
 *
 * Ein Produkt, das seine Kernaussage hinter Bezahlung stellt, kann sie
 * nicht mehr beweisen.
 */

export type PlanKey = "free" | "premium";

export interface Plan {
  key: PlanKey;
  name: string;
  /** Ein Satz, warum es diesen Plan gibt. */
  claim: string;
  preisMonatCent: number;
  /** Jahrespreis je Monat gerechnet — der Rabatt wird sichtbar, nicht behauptet. */
  preisJahrProMonatCent: number;
  enthalten: string[];
}

export const PLAENE: Record<PlanKey, Plan> = {
  free: {
    key: "free",
    name: "Free",
    claim: "Nina kennenlernen und die ersten echten Möglichkeiten sehen.",
    preisMonatCent: 0,
    preisJahrProMonatCent: 0,
    enthalten: [
      "Karrieregespräch mit Nina",
      "Bestätigte Stärken im Profil",
      "Stellen mit begründeter Passung",
      "Bewerbung vorbereiten",
      "Arbeitswelt-Radar",
      "Deine Daten exportieren und löschen",
    ],
  },
  premium: {
    key: "premium",
    name: "Premium",
    claim: "Tiefer verstehen, mehr sehen, in deiner Sprache sprechen.",
    // 12 € im Monat, 9 € bei jährlicher Zahlung — 25 % weniger.
    preisMonatCent: 1200,
    preisJahrProMonatCent: 900,
    enthalten: [
      "Tiefe Analyse je Stelle: Haken, Warnsignale, offene Punkte",
      "Unbegrenzte Jobvorschläge statt der ersten Auswahl",
      "Live-Gespräch mit Nina statt nur Diktat",
      "Nina in allen unterstützten Sprachen",
      "Ausführliche Bewerbungsunterlagen",
      "Begleitung nach dem Absenden: Nachfassen und Fristen",
    ],
  },
};

/**
 * Die Merkmale, die wirklich hinter der Schranke liegen.
 *
 * Bewusst eine kurze, benannte Liste statt eines Schalters je Seite.
 * Wer Sperren verstreut, sperrt irgendwann versehentlich das halbe
 * Produkt — genau das war der Zustand vorher.
 */
export type PremiumMerkmal =
  | "tiefe_jobanalyse"
  | "unbegrenzte_jobs"
  | "live_gespraech"
  | "alle_sprachen"
  | "ausfuehrliche_unterlagen"
  | "bewerbungsbegleitung";

/** Wie viele Stellen Free sieht. Nicht null — nur weniger. */
export const FREE_JOB_LIMIT = 25;

export const MERKMAL_TEXT: Record<PremiumMerkmal, { titel: string; nutzen: string }> = {
  tiefe_jobanalyse: {
    titel: "Tiefe Analyse dieser Stelle",
    nutzen: "Was die Anzeige verschweigt, welche Warnsignale darin stehen und was offen bleibt.",
  },
  unbegrenzte_jobs: {
    titel: "Alle passenden Stellen",
    nutzen: `Free zeigt die ersten ${FREE_JOB_LIMIT}. Premium zeigt jede, die zu dir passt.`,
  },
  live_gespraech: {
    titel: "Live mit Nina sprechen",
    nutzen: "Sprechen statt tippen — Nina hört zu, antwortet mit ihrer Stimme und lässt sich unterbrechen.",
  },
  alle_sprachen: {
    titel: "Nina in deiner Sprache",
    nutzen: "Das Gespräch und deine Unterlagen in jeder unterstützten Sprache.",
  },
  ausfuehrliche_unterlagen: {
    titel: "Ausführliche Bewerbungsunterlagen",
    nutzen: "Anschreiben, Lebenslauf und Screening-Antworten, auf diese eine Stelle zugeschnitten.",
  },
  bewerbungsbegleitung: {
    titel: "Begleitung nach dem Absenden",
    nutzen: "Fristen, Nachfassen und der nächste sinnvolle Schritt.",
  },
};

export function preisText(cent: number): string {
  return cent === 0
    ? "kostenlos"
    : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cent / 100);
}
