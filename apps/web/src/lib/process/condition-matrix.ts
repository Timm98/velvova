/**
 * Was vor einer Bewerbung geklärt sein muss.
 *
 * Der teuerste Ablauf in einer Jobsuche: vier Gespräche, drei Wochen,
 * und dann stellt sich heraus, dass die Stelle 40 % Reisetätigkeit
 * verlangt. Das steht in keiner Anzeige, weil niemand danach gefragt
 * hat — und weil die Anzeige es nicht sagen musste.
 *
 * Diese Datei sortiert jede Bedingung in genau drei Fächer:
 *
 *   **bestätigt** — steht in der Anzeige, mit Fundstelle.
 *   **unklar**    — steht nicht da. Nicht „egal", nicht „passt schon".
 *   **Konflikt**  — steht da und widerspricht einer harten Bedingung.
 *
 * Das mittlere Fach ist das wichtigste. Ein Produkt, das Unbekanntes
 * als unproblematisch behandelt, verschiebt die böse Überraschung nur
 * nach hinten.
 */

export type ConditionStatus = "confirmed" | "ambiguous" | "unknown" | "not_applicable";

export interface ConditionFact {
  key: string;
  label: string;
  value: string | null;
  status: ConditionStatus;
  /** Der Textausschnitt, auf den sich die Angabe stützt. */
  evidence: string | null;
  confidence: number;
  /** Steht ein „kein" davor? Dann bedeutet der Treffer das Gegenteil. */
  negated?: boolean;
}

export interface ConditionConflict {
  key: string;
  label: string;
  jobValue: string;
  userValue: string;
  /** In ganzen Sätzen. Steht so in der Oberfläche. */
  explanation: string;
}

export interface PreflightResult {
  confirmed: ConditionFact[];
  unclear: ConditionFact[];
  conflicts: ConditionConflict[];
  /** Höchstens fünf. Mehr liest niemand, und mehr merkt sich niemand. */
  questions: string[];
  recommendation: "prepare" | "clarify_first" | "deprioritise";
  summary: string;
}

interface Regel {
  key: string;
  label: string;
  patterns: RegExp[];
  /** Wie der Wert aus dem Treffer gelesen wird. */
  read?: (m: RegExpMatchArray) => string;
  /** Die Frage, wenn nichts dasteht. */
  question: string;
}

const REGELN: Regel[] = [
  {
    key: "remote",
    label: "Arbeitsmodell",
    patterns: [
      /\b(vollständig remote|100\s?% remote|remote first|voll remote)\b/i,
      /\b(hybrid|(\d)\s?tage?\s?(pro woche\s?)?(im )?(büro|office|vor ort))\b/i,
      /\b(vor ort|präsenz|onsite|kein remote|keine remote)\b/i,
    ],
    question: "Wie viele Tage pro Woche sind vor Ort erwartet?",
  },
  {
    key: "contract",
    label: "Vertragsart",
    patterns: [/\b(unbefristet|befristet auf \d+|befristet|zeitarbeit|arbeitnehmerüberlassung|freelance|werkvertrag)\b/i],
    question: "Ist die Stelle unbefristet?",
  },
  {
    key: "hours",
    label: "Arbeitszeit",
    patterns: [/\b(vollzeit|teilzeit|(\d{2})\s?(stunden|std\.?)\s?(pro |\/)?woche)\b/i],
    question: "Wie viele Wochenstunden sind vorgesehen?",
  },
  {
    key: "travel",
    label: "Reisetätigkeit",
    // Der Prozentwert steht HINTER dem Wort, oft mit einem halben Satz
    // dazwischen. Die erste Fassung machte die Prozentgruppe optional
    // und faul — sie fand "Reisebereitschaft" und hörte auf, bevor die
    // Zahl kam. Der Konflikt fiel damit nie auf.
    patterns: [
      /\b(reisebereitschaft|reiseanteil|dienstreisen)\b[^.]{0,40}\d{1,3}\s?%/i,
      /\d{1,3}\s?%[^.]{0,30}\b(reise|dienstreisen)/i,
      /\b(reisebereitschaft|reiseanteil|dienstreisen)\b/i,
    ],
    question: "Wie hoch ist der Reiseanteil tatsächlich?",
  },
  {
    key: "shift",
    label: "Schichtarbeit",
    patterns: [/\b(schichtbetrieb|schichtarbeit|drei[- ]?schicht|zwei[- ]?schicht|wechselschicht|nachtschicht|rufbereitschaft|wochenenddienst)\b/i],
    question: "Gibt es Schicht-, Nacht- oder Wochenenddienste?",
  },
  {
    key: "salary",
    label: "Gehalt",
    patterns: [/(\d{2}\.?\d{3})\s?(–|-|bis)\s?(\d{2}\.?\d{3})\s?(€|eur)/i, /\b(gehalt|vergütung)\b[^.]{0,30}(\d{2}\.?\d{3})/i],
    question: "In welchem Rahmen liegt das Gehalt für diese Stelle?",
  },
  {
    key: "start",
    label: "Beginn",
    patterns: [/\b(ab sofort|zum nächstmöglichen zeitpunkt|ab \d{1,2}\.\d{1,2}\.|ab (januar|februar|märz|april|mai|juni|juli|august|september|oktober|november|dezember))\b/i],
    question: "Wann soll die Stelle besetzt werden?",
  },
  {
    key: "team",
    label: "Team",
    patterns: [/\b(team (aus|von) \d+|(\d+)[- ]köpfiges team|kleines team|team mit \d+)\b/i],
    question: "Wie gross ist das Team und an wen berichtet die Rolle?",
  },
];

export interface PreflightInput {
  description: string;
  /** Was die Stellendaten strukturiert hergeben. */
  structured?: Partial<Record<string, string | null>>;
  /** Die harten Bedingungen der Person, als lesbare Werte. */
  userConstraints?: {
    maxTravelPercent?: number | null;
    remoteRequired?: boolean;
    maxCommuteMinutes?: number | null;
    minSalary?: number | null;
    noShiftWork?: boolean;
  };
  /** Was das Ranking bereits als harten Konflikt erkannt hat. */
  knownConflicts?: ConditionConflict[];
}

function ausschnitt(text: string, m: RegExpMatchArray): string {
  const i = m.index ?? 0;
  const von = Math.max(0, i - 30);
  const bis = Math.min(text.length, i + m[0].length + 30);
  return `${von > 0 ? "…" : ""}${text.slice(von, bis).replace(/\s+/g, " ").trim()}${bis < text.length ? "…" : ""}`;
}

export function buildPreflight(input: PreflightInput): PreflightResult {
  const text = input.description;
  const confirmed: ConditionFact[] = [];
  const unclear: ConditionFact[] = [];
  const questions: string[] = [];

  for (const regel of REGELN) {
    const strukturiert = input.structured?.[regel.key];
    if (strukturiert) {
      confirmed.push({
        key: regel.key,
        label: regel.label,
        value: strukturiert,
        status: "confirmed",
        evidence: null,
        confidence: 0.9,
      });
      continue;
    }

    let treffer: RegExpMatchArray | null = null;
    for (const p of regel.patterns) {
      treffer = text.match(p);
      if (treffer) break;
    }

    if (treffer) {
      /*
       * Verneinung erkennen.
       *
       * "keine Schichtarbeit" enthält das Wort "Schichtarbeit". Ein
       * Muster, das nur nach dem Substantiv sucht, meldet der Person
       * Schichtdienst in einer Anzeige, die ausdrücklich keinen hat —
       * und erzeugt damit einen Konflikt, den es nicht gibt.
       */
      const davor = text.slice(Math.max(0, (treffer.index ?? 0) - 25), treffer.index ?? 0);
      const verneint = /\b(keine?|kein|ohne|nicht)\s*$/i.test(davor.trimEnd() + " ");

      confirmed.push({
        key: regel.key,
        label: regel.label,
        value: verneint ? `keine ${treffer[0].trim()}` : treffer[0].trim(),
        status: "confirmed",
        evidence: ausschnitt(text, treffer),
        confidence: 0.65,
        negated: verneint,
      });
    } else {
      // Nicht „passt schon". Unbekannt ist ein eigener Zustand, und
      // genau der erzeugt die böse Überraschung im vierten Gespräch.
      unclear.push({
        key: regel.key,
        label: regel.label,
        value: null,
        status: "unknown",
        evidence: null,
        confidence: 0,
      });
      questions.push(regel.question);
    }
  }

  const conflicts = [...(input.knownConflicts ?? [])];

  // Reisetätigkeit gegen die eigene Grenze — der häufigste Konflikt,
  // der erst spät auffällt.
  const reise = confirmed.find((c) => c.key === "travel");
  const maxReise = input.userConstraints?.maxTravelPercent;
  if (reise && !reise.negated && typeof maxReise === "number") {
    // Aus dem Beleg lesen, nicht aus dem gekürzten Wert: der Prozentwert
    // kann ausserhalb des eigentlichen Treffers stehen.
    const prozent = `${reise.value ?? ""} ${reise.evidence ?? ""}`.match(/(\d{1,3})\s?%/);
    if (prozent && Number(prozent[1]) > maxReise) {
      conflicts.push({
        key: "travel",
        label: "Reisetätigkeit",
        jobValue: `${prozent[1]} %`,
        userValue: `höchstens ${maxReise} %`,
        explanation: `Die Anzeige nennt ${prozent[1]} % Reiseanteil, deine Grenze liegt bei ${maxReise} %.`,
      });
    }
  }

  const schicht = confirmed.find((c) => c.key === "shift");
  if (schicht && !schicht.negated && input.userConstraints?.noShiftWork) {
    conflicts.push({
      key: "shift",
      label: "Schichtarbeit",
      jobValue: schicht.value ?? "genannt",
      userValue: "keine Schichtarbeit",
      explanation: "Die Anzeige nennt Schicht- oder Bereitschaftsdienst, den du ausgeschlossen hast.",
    });
  }

  const recommendation: PreflightResult["recommendation"] =
    conflicts.length > 0 ? "deprioritise" : unclear.length >= 4 ? "clarify_first" : "prepare";

  const summary =
    conflicts.length > 0
      ? `${conflicts.length === 1 ? "Ein Punkt widerspricht" : `${conflicts.length} Punkte widersprechen`} deinen Bedingungen.`
      : unclear.length >= 4
        ? `${unclear.length} wichtige Punkte stehen nicht in der Anzeige. Es lohnt sich, vorher zu fragen.`
        : `${confirmed.length} von ${REGELN.length} Punkten sind belegt.`;

  return {
    confirmed,
    unclear,
    conflicts,
    // Höchstens fünf: mehr liest niemand, und mehr merkt sich niemand
    // im Gespräch.
    questions: questions.slice(0, 5),
    recommendation,
    summary,
  };
}
