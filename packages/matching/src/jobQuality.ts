import type { Job, JobQualityResult, ReviewAggregate, ReviewTheme } from "@paycheck/domain";
import { SCORING_VERSION } from "@paycheck/domain";
import { toScore100, weightedScore, type WeightedInput } from "./weighted.ts";

/**
 * Job Quality steht getrennt vom Fit. Eine Stelle kann fachlich perfekt
 * passen und trotzdem ein schlechter Arbeitsplatz sein. Beides in eine
 * Zahl zu ruehren würde genau die Information zerstoeren, die zählt.
 *
 * Die Dimensionen folgen der mehrdimensionalen Sicht auf Jobqualität
 * (Einkommen, Sicherheit, Arbeitsumfeld), wie sie die OECD verwendet.
 * Siehe docs/RESEARCH_RATIONALE.md.
 */

export interface JobQualityInput {
  job: Job;
  reviews: ReviewAggregate[];
  themes: ReviewTheme[];
  /** Regionaler Referenzwert für das Gehalt, falls bekannt. */
  salaryBenchmarkPerYear?: number | null;
  /**
   * Die Mitarbeiterzahl des Arbeitgebers, als Spanne.
   *
   * Kommt aus der Firmenanreicherung — „201-500 employees",
   * „10,001+ employees". Als Zahl ginge es nicht: „10,001+" ist keine.
   */
  mitarbeiter?: string | null;
}

/**
 * Betriebsgrösse als Stabilitätssignal.
 *
 * ── Warum sie überhaupt zählt ─────────────────────────────────
 *
 * Die Frage „ist dieser Job in ein paar Jahren noch da" hing bisher
 * allein an der Vertragsart. Ein unbefristeter Vertrag bei einem
 * Dreipersonenbetrieb und einer bei einem Konzern sind aber nicht
 * dasselbe Versprechen: Grosse Arbeitgeber überstehen einen schlechten
 * Auftragseingang, kleine nicht immer.
 *
 * ── Warum sie nur ein Zuschlag ist und kein eigener Wert ──────
 *
 * Gross heisst nicht besser. Ein Konzern ist stabiler und oft
 * unbeweglicher; ein kleiner Betrieb ist verletzlicher und oft näher
 * an der Entscheidung. Die Grösse verschiebt die Sicherheit deshalb
 * um höchstens ein Fünftel nach oben oder unten — sie ersetzt die
 * Vertragsart nicht.
 *
 * ── Warum der mittlere Bereich neutral ist ────────────────────
 *
 * Zwischen fünfzig und tausend Beschäftigten sagt die Zahl über
 * Bestandsfestigkeit wenig. Dort etwas zu unterstellen wäre eine
 * Genauigkeit, die die Daten nicht hergeben.
 */
export function groessenZuschlag(mitarbeiter: string | null | undefined): number {
  if (!mitarbeiter) return 0;
  const t = mitarbeiter.toLowerCase();
  if (/10,?001|10001\+|myriad/.test(t)) return 0.2;
  if (/5,?001|1,?001|1001-|5001-/.test(t)) return 0.15;
  if (/501-|201-/.test(t)) return 0.05;
  if (/51-200/.test(t)) return 0;
  if (/11-50/.test(t)) return -0.1;
  if (/\b2-10\b|1-10\b|self-employed/.test(t)) return -0.2;
  return 0;
}

function themeScore(themes: ReviewTheme[], keywords: string[]): number | null {
  const relevant = themes.filter((t) =>
    keywords.some((k) => t.theme.toLowerCase().includes(k) || t.summary.toLowerCase().includes(k)),
  );
  if (relevant.length === 0) return null;
  const total = relevant.reduce((s, t) => s + t.mentionCount, 0);
  if (total === 0) return null;
  const positive = relevant.filter((t) => t.sentiment === "positive").reduce((s, t) => s + t.mentionCount, 0);
  const mixed = relevant.filter((t) => t.sentiment === "mixed").reduce((s, t) => s + t.mentionCount, 0);
  return (positive + mixed * 0.5) / total;
}

export function computeJobQuality(input: JobQualityInput): JobQualityResult {
  const { job, reviews, themes } = input;

  // --- Einkommensqualität ---
  let income: number | null = null;
  if (job.salary.disclosed && (job.salary.min ?? job.salary.max) !== null) {
    const mid = job.salary.max && job.salary.min
      ? (job.salary.min + job.salary.max) / 2
      : (job.salary.max ?? job.salary.min ?? 0);
    const yearly = job.salary.period === "month" ? mid * 12 : job.salary.period === "hour" ? mid * 40 * 52 : mid;
    const bench = input.salaryBenchmarkPerYear ?? null;
    if (bench && bench > 0) {
      income = Math.min(1, Math.max(0, 0.5 + (yearly - bench) / (bench * 0.8)));
    } else {
      // Ohne Referenz zählt nur, dass überhaupt transparent gemacht wird.
      income = 0.6;
    }
  }

  // --- Beschäftigungssicherheit ---
  let security: number | null = null;
  if (job.contractType !== null) {
    const map: Record<string, number> = {
      permanent: 1, apprenticeship: 0.8, fixed_term: 0.5, working_student: 0.4,
      internship: 0.3, freelance: 0.35, temp_agency: 0.3,
    };
    security = map[job.contractType] ?? null;
  } else if (job.benefits.some((b) => /altersvorsorge/i.test(b))) {
    /*
     * Betriebliche Altersvorsorge ohne genannte Vertragsart.
     *
     * Sie ist kein Beweis für einen unbefristeten Vertrag, aber ein
     * belastbares Indiz: Ein Arbeitgeber richtet sie nicht für eine
     * Dreimonatsstelle ein. Deshalb ein gedämpfter Wert und nicht der
     * volle — und nur, wenn die Vertragsart wirklich fehlt.
     */
    security = 0.7;
  }

  /*
   * Die Betriebsgrösse verschiebt die Sicherheit, ersetzt sie nicht.
   *
   * Nur wo schon ein Wert steht: Aus der Grösse allein eine
   * Beschäftigungssicherheit abzuleiten hiesse, „grosser Arbeitgeber"
   * mit „sicherer Vertrag" zu verwechseln. Ein befristeter Vertrag im
   * Konzern bleibt befristet.
   */
  if (security !== null) {
    security = Math.max(0, Math.min(1, security + groessenZuschlag(input.mitarbeiter)));
  }

  // --- Arbeitsbelastung und Umfeld ---
  const workload = themeScore(themes, ["belastung", "workload", "überstunden", "overtime", "stress", "druck"]);

  /*
   * ── Was die Anzeige selbst sagt ────────────────────────────
   *
   * Vier der sechs Dimensionen hingen ausschliesslich an
   * Mitarbeiterstimmen. Die haben wir für fast keine Stelle — also war
   * die Abdeckung fast immer unter der Schwelle, und die Antwort lautete
   * bei 2.400 von 2.500 Stellen „nicht ausreichend beurteilbar".
   *
   * Eine Bewertung, die fast nie eine Bewertung abgibt, ordnet nichts.
   * Die Liste stand damit in beliebiger Reihenfolge da.
   *
   * Dabei steht in der Anzeige selbst eine Menge über die Langfristigkeit
   * einer Stelle: 30 Urlaubstage, betriebliche Altersvorsorge und
   * Weiterbildung sind Aussagen über Entwicklung und Sicherheit — und
   * sie liegen für 65 % der Stellen vor, weil der Leistungserkenner sie
   * aus dem Text liest.
   *
   * Mitarbeiterstimmen bleiben das stärkere Signal und haben deshalb
   * Vorrang. Wo es sie nicht gibt, tritt die Anzeige an ihre Stelle —
   * mit einem gedämpften Wert, weil eine Selbstauskunft weniger wert ist
   * als eine Erfahrung.
   */
  const hat = (art: string) => job.benefits.some((b) => b.toLowerCase().includes(art));

  /** Selbstauskunft zählt gedämpft: 0,5 bis 0,8 statt 0 bis 1. */
  const ausAnzeige = (treffer: boolean[]): number | null => {
    const anzahl = treffer.filter(Boolean).length;
    if (treffer.length === 0) return null;
    return 0.5 + Math.min(0.3, anzahl * 0.15);
  };

  // --- Arbeitszeit und Flexibilität ---
  let flexibility: number | null = null;
  const flexSignals: number[] = [];
  if (job.remotePercent !== null) flexSignals.push(Math.min(1, job.remotePercent / 100));
  if (job.shiftWork !== null) flexSignals.push(job.shiftWork ? 0.3 : 0.8);
  const flexTheme = themeScore(themes, ["flexib", "work-life", "gleitzeit", "homeoffice"]);
  if (flexTheme !== null) flexSignals.push(flexTheme);
  else {
    const ausText = ausAnzeige([hat("homeoffice"), hat("flexible arbeitszeit")]);
    if (ausText !== null && job.benefits.length > 0) flexSignals.push(ausText);
  }
  if (job.workModel === "remote") flexSignals.push(0.9);
  else if (job.workModel === "hybrid") flexSignals.push(0.75);
  if (flexSignals.length > 0) flexibility = flexSignals.reduce((a, b) => a + b, 0) / flexSignals.length;

  // --- Führung und Kultur ---
  /*
   * Kultur bleibt bei den Stimmen.
   *
   * „Wir sind ein tolles Team" steht in jeder zweiten Anzeige und sagt
   * nichts. Für diese Dimension gibt es keinen Ersatz aus dem Text —
   * und eine erfundene Zahl wäre schlimmer als eine fehlende.
   */
  const culture = themeScore(themes, ["fuehrung", "leadership", "vorgesetzt", "manager", "kultur", "team", "kollegen"]);

  // --- Entwicklung und Lernen ---
  const developmentTheme = themeScore(themes, ["entwicklung", "lernen", "weiterbildung", "training", "karriere", "growth"]);
  const development =
    developmentTheme ??
    (job.benefits.length > 0 ? ausAnzeige([hat("weiterbildung")]) : null);

  /*
   * ── Offenheit der Anzeige ──────────────────────────────────
   *
   * Die einzige Dimension, die IMMER beurteilbar ist — und sie ist kein
   * Verlegenheitsersatz. Was eine Anzeige preisgibt, sagt etwas über
   * den Arbeitgeber: Wer Gehalt, Wochenstunden und Vertragsart nennt,
   * respektiert die Zeit der Lesenden. Wer nichts davon nennt, verlagert
   * die Klärung in ein Gespräch, das man erst führen muss.
   *
   * Sie trägt ausserdem die Abdeckung. Ohne sie lag die höchste
   * erreichbare Abdeckung ohne Mitarbeiterstimmen bei 0,45 — unter der
   * Schwelle von 0,5. Die Gesamtnote konnte also NIE zustande kommen,
   * egal wie viel in der Anzeige stand. Gemessen: 1,5 % beurteilbar.
   */

  /*
   * Die Gewichte folgen dem, was tatsächlich vorliegt.
   *
   * Vorher trugen die vier Dimensionen aus Mitarbeiterstimmen 70 % —
   * richtig für ein Produkt mit Bewertungsdaten, falsch für unseres:
   * Wir haben für fast keine Stelle welche. Die Stimmen bleiben das
   * stärkere Signal, wo es sie gibt; die Anzeige trägt jetzt genug, um
   * überhaupt zu einem Urteil zu kommen.
   */
  const inputs: WeightedInput[] = [
    /*
     * „Offenheit der Anzeige" stand hier mit 15 % Gewicht — und
     * gehörte nicht hierher.
     *
     * Sie misst, was die Anzeige PREISGIBT; die übrigen sechs
     * Dimensionen messen, was die Stelle BIETET. In einer Zahl ergaben
     * eine ausführliche Anzeige mit schlechten Bedingungen und eine
     * knappe mit guten denselben Wert.
     *
     * Die Transparenz steht jetzt eigenständig in `anzeigenqualitaet`
     * — sechs gleich gewichtete Punkte, getrennt ausgewiesen. Ihr
     * Gewicht verteilt `weightedScore` auf die verbliebenen
     * Dimensionen um; die Gewichte unten bleiben deshalb unverändert
     * und ihr Verhältnis zueinander stimmt weiterhin.
     */
    { key: "income", label: "Einkommensqualität und Fairness", raw: income, weight: 0.10,
      explanation: income === null ? "Die Anzeige nennt kein Gehalt - das ist keine schlechte, sondern gar keine Angabe."
        : job.salary.disclosed ? "Gehalt ist offengelegt und eingeordnet." : "" },
    { key: "security", label: "Beschäftigungssicherheit", raw: security, weight: 0.20,
      explanation: security === null ? "Die Vertragsart ist nicht angegeben."
        : `Vertragsart: ${job.contractType}.` },
    { key: "workload", label: "Arbeitsbelastung und Arbeitsumfeld", raw: workload, weight: 0.10,
      explanation: workload === null ? "Keine belastbaren Aussagen zur Arbeitsbelastung vorhanden."
        : "Aus Mitarbeiterstimmen zu Belastung und Arbeitsumfeld." },
    { key: "flexibility", label: "Arbeitszeit und Flexibilität", raw: flexibility, weight: 0.20,
      explanation: flexibility === null ? "Keine Angaben zu Arbeitszeit oder Flexibilität."
        : "Aus Arbeitsmodell, Schichtangabe und dem, was die Anzeige zu Flexibilität nennt." },
    { key: "culture", label: "Führung, Kultur und soziale Bedingungen", raw: culture, weight: 0.10,
      explanation: culture === null ? "Keine belastbaren Aussagen zu Führung und Kultur."
        : "Aus Mitarbeiterstimmen zu Führung und Zusammenarbeit." },
    { key: "development", label: "Entwicklung und Lernmoeglichkeiten", raw: development, weight: 0.15,
      explanation: development === null ? "Keine Angaben zu Entwicklungsmöglichkeiten."
        : developmentTheme !== null
          ? "Aus Mitarbeiterstimmen zu Lernen und Weiterentwicklung."
          : "Aus dem, was die Anzeige zu Weiterbildung nennt." },
  ];

  const { value, coverage, factors } = weightedScore(inputs);

  // Unter dieser Abdeckung ist eine Gesamtzahl irrefuehrend. Dann sagen wir
  // "nicht ausreichend beurteilbar" statt einen schlechten Wert zu zeigen.
  const MIN_COVERAGE = 0.5;
  const insufficient = value === null || coverage < MIN_COVERAGE;

  void reviews;
  return {
    score: insufficient ? null : toScore100(value),
    insufficientData: insufficient,
    dimensions: factors,
    version: SCORING_VERSION,
  };
}
