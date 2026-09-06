import { createHash } from "node:crypto";

/**
 * Wann eine Stelle neu analysiert werden muss — und wann nicht.
 *
 * ══════════════════════════════════════════════════════════════
 * Die Frage, die diese Datei beantwortet
 * ══════════════════════════════════════════════════════════════
 *
 * Der Import sieht dieselbe Anzeige täglich wieder. Jedes Mal ändert
 * sich `last_seen_at`, meistens sonst nichts.
 *
 * Würde das eine Analyse auslösen, liefe die teuerste Arbeit im System
 * täglich für eine Million unveränderte Anzeigen. Würde umgekehrt gar
 * nichts auslösen, bliebe eine Anzeige, die ihr Gehalt geändert hat,
 * für immer mit der alten Einschätzung stehen.
 *
 * Der Schlüssel entscheidet: Er enthält genau die Felder, deren
 * Änderung eine andere Analyse ergeben würde.
 *
 * ══════════════════════════════════════════════════════════════
 * Was drin ist und warum
 * ══════════════════════════════════════════════════════════════
 *
 * Titel und Volltext, weil die Analyse sie liest. Gehalt, Ort,
 * Vertrag, Arbeitszeit und Arbeitsmodell, weil sie strukturiert in die
 * Bewertung eingehen — eine Anzeige, die von Vollzeit auf Teilzeit
 * wechselt, ist eine andere Stelle.
 *
 * NICHT drin: `last_seen_at`, `fetched_at`, Abrufzähler, die Quelle,
 * die Kennung. Sie sagen etwas über unseren Import, nichts über die
 * Stelle.
 */

/** Die Felder, deren Änderung eine neue Analyse rechtfertigt. */
export type Analyseeingabe = {
  title: string;
  description: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string | null;
  location: string | null;
  country: string | null;
  workModel: string | null;
  contractType: string | null;
  weeklyHours: number | null;
  experienceLevel: string | null;
};

/**
 * Der Fingerabdruck der Eingabe.
 *
 * ── Warum sortierte Schlüssel ─────────────────────────────────
 *
 * `JSON.stringify` eines Objekts folgt der Einfügereihenfolge. Zwei
 * gleiche Anzeigen aus verschiedenen Codepfaden ergäben sonst
 * verschiedene Prüfsummen — und damit eine Neuanalyse, obwohl sich
 * nichts geändert hat.
 *
 * ── Warum der Text normalisiert wird ──────────────────────────
 *
 * Quellen liefern denselben Text mal mit `\r\n`, mal mit `\n`, mal mit
 * doppelten Leerzeichen. Das ist keine Änderung der Anzeige, sondern
 * eine des Transports.
 */
export function analyseschluessel(e: Analyseeingabe): string {
  const normalisiert = (t: string | null) =>
    t === null ? null : t.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();

  const felder: Record<string, unknown> = {
    title: normalisiert(e.title),
    description: normalisiert(e.description),
    salaryMin: e.salaryMin,
    salaryMax: e.salaryMax,
    salaryCurrency: e.salaryCurrency,
    salaryPeriod: e.salaryPeriod,
    location: normalisiert(e.location),
    country: e.country,
    workModel: e.workModel,
    contractType: e.contractType,
    weeklyHours: e.weeklyHours,
    experienceLevel: e.experienceLevel,
  };

  const stabil = Object.keys(felder)
    .sort()
    .map((k) => [k, felder[k]] as const);

  return createHash("sha256").update(JSON.stringify(stabil)).digest("hex").slice(0, 32);
}

/**
 * Die Fassung der Analyselogik.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das neben dem Eingabeschlüssel steht
 * ══════════════════════════════════════════════════════════════
 *
 * Eine Analyse veraltet aus zwei Gründen: Die Anzeige hat sich
 * geändert, oder wir haben uns geändert — neue Kriterien, andere
 * Gewichte, ein anderer Prompt, eine neuere Referenzquelle.
 *
 * Der zweite Fall ist der, den man vergisst. Ohne ihn läuft nach einer
 * Regeländerung die halbe Datenbank mit Ergebnissen weiter, die nach
 * den alten Regeln entstanden sind — und niemand sieht es, weil die
 * Zahlen plausibel aussehen.
 *
 * Wer eine dieser Zahlen erhöht, löst eine Neuanalyse aus. Das ist
 * beabsichtigt und teuer; deshalb steht es hier sichtbar und nicht in
 * einer Konfigurationsdatei.
 */
export const ANALYSE_FASSUNG = {
  /** Das Schema der extrahierten Fakten. */
  schema: 1,
  /** Der Analyse-Systemprompt. */
  prompt: 1,
  /** Kriterien, Gewichte und Anker der Bewertung. */
  scoring: 1,
} as const;

/** Die Fassung als eine Zahl, für den Vergleich in SQL. */
export function fassungsstand(): number {
  const f = ANALYSE_FASSUNG;
  /* Zehnerpotenzen statt Verkettung: So bleibt der Vergleich „neuer
     als" ein einfaches Grösser-als, und eine erhöhte Teilfassung
     ergibt immer einen höheren Gesamtwert. */
  return f.schema * 1_000_000 + f.prompt * 1_000 + f.scoring;
}

/**
 * Ob eine gespeicherte Analyse noch gilt.
 *
 * Getrennte Gründe, weil der Aufrufer sie verschieden behandelt: Eine
 * veraltete Fassung darf die vorhandene Extraktion wiederverwenden und
 * nur neu rechnen; eine geänderte Anzeige nicht.
 */
export type Pruefung =
  | { gueltig: true }
  | { gueltig: false; grund: "anzeige_geaendert" | "fassung_veraltet" | "fehlt" };

export function analysePruefen(
  gespeichert: { schluessel: string; fassung: number } | null,
  aktuellerSchluessel: string,
): Pruefung {
  if (!gespeichert) return { gueltig: false, grund: "fehlt" };
  if (gespeichert.schluessel !== aktuellerSchluessel) {
    return { gueltig: false, grund: "anzeige_geaendert" };
  }
  if (gespeichert.fassung < fassungsstand()) {
    return { gueltig: false, grund: "fassung_veraltet" };
  }
  return { gueltig: true };
}
