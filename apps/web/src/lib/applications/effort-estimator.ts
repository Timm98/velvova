import type { ClassifiedRequirement } from "@/lib/experience/requirement-classifier";

/**
 * Was eine Bewerbung kostet.
 *
 * Zwei fachlich gleichwertige Stellen können fünf Minuten oder eine
 * Stunde kosten: die eine nimmt einen Lebenslauf entgegen, die andere
 * verlangt ein Konto, zwölf Freitextfelder und den kompletten
 * Werdegang noch einmal von Hand.
 *
 * Diese Zahl gehört **vor** die Entscheidung. Danach ist sie nur noch
 * Ärger.
 *
 * Was hier ausdrücklich nicht berechnet wird: eine
 * Einstellungswahrscheinlichkeit. Sie wäre erfunden.
 */

export type EffortSource =
  | "provider_data"
  | "employer_data"
  | "user_reported"
  | "historical_aggregate"
  | "inferred"
  | "unknown";

export type EffortLevel = "gering" | "mittel" | "hoch" | "unbekannt";

export interface EffortEstimate {
  level: EffortLevel;
  minutesMin: number | null;
  minutesMax: number | null;
  source: EffortSource;
  confidence: number;
  /** Was den Aufwand ausmacht, in Stichworten für eine Zeile. */
  drivers: string[];
  /** Ein Satz für die Oberfläche. */
  summary: string;
}

export interface EffortInput {
  applyMethod: string;
  applyTarget: string | null;
  /** Adresse der Originalanzeige — der Weg verrät oft den Aufwand. */
  originalUrl: string | null;
  requirements: ClassifiedRequirement[];
  /** Bereits bekannte Angaben, etwa vom Anbieter. */
  known?: Partial<{
    accountRequired: boolean;
    coverLetterRequired: boolean;
    screeningQuestionsCount: number;
    portfolioRequired: boolean;
    assessmentLikely: boolean;
    videoRequired: boolean;
  }>;
}

/**
 * Bewerbungssysteme, deren Aufwand bekannt ist.
 *
 * Die Zahlen stammen aus dem, was diese Systeme tatsächlich verlangen,
 * nicht aus einer Vermutung über den Arbeitgeber. Ein Workday-Formular
 * ist bei jedem Unternehmen ein Workday-Formular.
 */
const SYSTEME: { muster: RegExp; name: string; min: number; max: number; konto: boolean; treiber: string[] }[] = [
  { muster: /workday|myworkdayjobs/i, name: "Workday", min: 30, max: 60, konto: true,
    treiber: ["Konto nötig", "Werdegang von Hand"] },
  { muster: /taleo|oracle.*recruit/i, name: "Oracle/Taleo", min: 30, max: 60, konto: true,
    treiber: ["Konto nötig", "Werdegang von Hand"] },
  { muster: /icims/i, name: "iCIMS", min: 20, max: 40, konto: true, treiber: ["Konto nötig"] },
  { muster: /successfactors|sap\.com\/careers/i, name: "SuccessFactors", min: 25, max: 50, konto: true,
    treiber: ["Konto nötig", "Werdegang von Hand"] },
  { muster: /greenhouse/i, name: "Greenhouse", min: 8, max: 20, konto: false,
    treiber: ["Lebenslauf hochladen"] },
  { muster: /lever\.co/i, name: "Lever", min: 8, max: 20, konto: false,
    treiber: ["Lebenslauf hochladen"] },
  { muster: /ashbyhq/i, name: "Ashby", min: 8, max: 20, konto: false,
    treiber: ["Lebenslauf hochladen"] },
  { muster: /smartrecruiters/i, name: "SmartRecruiters", min: 10, max: 25, konto: false,
    treiber: ["Lebenslauf hochladen"] },
  { muster: /personio/i, name: "Personio", min: 10, max: 20, konto: false,
    treiber: ["Lebenslauf hochladen"] },
  { muster: /recruitee|teamtailor|workable/i, name: "Bewerbungsportal", min: 10, max: 25, konto: false,
    treiber: ["Lebenslauf hochladen"] },
];

export function estimateEffort(input: EffortInput): EffortEstimate {
  const treiber: string[] = [];
  let min: number | null = null;
  let max: number | null = null;
  let source: EffortSource = "unknown";
  let confidence = 0.3;

  // 1. Bekannte Angaben schlagen alles. Sie sind gemessen, nicht geraten.
  const k = input.known ?? {};
  const hatBekannt = Object.values(k).some((v) => v !== undefined);

  // 2. Das Bewerbungssystem an der Adresse erkennen.
  const ziel = `${input.applyTarget ?? ""} ${input.originalUrl ?? ""}`;
  const system = SYSTEME.find((s) => s.muster.test(ziel));

  if (system) {
    min = system.min;
    max = system.max;
    source = "inferred";
    confidence = 0.6;
    treiber.push(...system.treiber);
  } else if (input.applyMethod === "email") {
    min = 15;
    max = 30;
    source = "inferred";
    confidence = 0.5;
    treiber.push("Bewerbung per E-Mail");
  }

  // 3. Bekannte Angaben oben drauf — und sie erhöhen die Sicherheit.
  if (k.accountRequired === true && !treiber.includes("Konto nötig")) {
    treiber.push("Konto nötig");
    min = (min ?? 10) + 8;
    max = (max ?? 20) + 12;
  }
  if (k.coverLetterRequired) {
    treiber.push("Anschreiben verlangt");
    min = (min ?? 10) + 20;
    max = (max ?? 20) + 40;
  }
  if (k.screeningQuestionsCount && k.screeningQuestionsCount > 0) {
    treiber.push(`${k.screeningQuestionsCount} Fragen`);
    min = (min ?? 10) + k.screeningQuestionsCount * 2;
    max = (max ?? 20) + k.screeningQuestionsCount * 5;
  }
  if (k.portfolioRequired) {
    treiber.push("Arbeitsproben");
    min = (min ?? 10) + 30;
    max = (max ?? 20) + 90;
  }
  if (k.videoRequired) {
    treiber.push("Videoaufnahme");
    min = (min ?? 10) + 20;
    max = (max ?? 20) + 45;
  }
  if (k.assessmentLikely) {
    treiber.push("Test wahrscheinlich");
    min = (min ?? 10) + 30;
    max = (max ?? 20) + 60;
  }

  if (hatBekannt) {
    source = source === "unknown" ? "provider_data" : "provider_data";
    confidence = Math.max(confidence, 0.75);
  }

  // 4. Anforderungen, die Nachweise verlangen, kosten Zeit.
  const nachweise = input.requirements.filter((r) => r.type === "legal_or_license").length;
  if (nachweise > 0) {
    treiber.push(`${nachweise} ${nachweise === 1 ? "Nachweis" : "Nachweise"} beilegen`);
    min = (min ?? 10) + nachweise * 5;
    max = (max ?? 20) + nachweise * 10;
  }

  /*
   * Unbekannt bleibt unbekannt.
   *
   * Eine erfundene Schätzung wäre schlimmer als keine: die Person
   * plant ihre Woche danach.
   */
  if (min === null || max === null) {
    return {
      level: "unbekannt",
      minutesMin: null,
      minutesMax: null,
      source: "unknown",
      confidence: 0,
      drivers: [],
      summary: "Der Bewerbungsaufwand ist von hier aus nicht erkennbar.",
    };
  }

  const level: EffortLevel = max <= 20 ? "gering" : max <= 45 ? "mittel" : "hoch";

  return {
    level,
    minutesMin: min,
    minutesMax: max,
    source,
    confidence,
    drivers: treiber,
    summary: `Bewerbungsaufwand ${level} · etwa ${min}–${max} Min.${treiber.length > 0 ? ` · ${treiber.join(", ")}` : ""}`,
  };
}

/**
 * Wie viel Aufwand passt noch in die Woche?
 *
 * Ohne diese Rechnung ist ein Wochenziel eine Zahl, die jemand
 * hinschreibt und dann nicht erreicht — und das nächste Mal glaubt,
 * es liege an ihm.
 */
export function fitsInBudget(
  estimates: EffortEstimate[],
  hoursAvailable: number,
): { passt: EffortEstimate[]; darueber: EffortEstimate[]; verplantMinuten: number } {
  const budget = hoursAvailable * 60;
  const passt: EffortEstimate[] = [];
  const darueber: EffortEstimate[] = [];
  let verplant = 0;

  for (const e of estimates) {
    // Mit der oberen Schätzung rechnen. Eine Planung, die vom besten
    // Fall ausgeht, geht schief — und zwar bei der Person, nicht bei uns.
    const kosten = e.minutesMax ?? 30;
    if (verplant + kosten <= budget) {
      passt.push(e);
      verplant += kosten;
    } else {
      darueber.push(e);
    }
  }

  return { passt, darueber, verplantMinuten: verplant };
}
