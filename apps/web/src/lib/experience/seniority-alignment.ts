/**
 * Wenn Erfahrung zum Nachteil wird.
 *
 * Die Überqualifikationsfalle: wer mehr kann als ausgeschrieben, wird
 * aussortiert und erfährt nie den Grund. Manchmal aus Sorge um die
 * Gehaltsvorstellung, manchmal aus Angst, die Person bleibe nicht.
 *
 * Das Produkt filtert deshalb **nicht**. Es benennt. Der Unterschied:
 *
 *   Filtern nimmt der Person die Möglichkeit.
 *   Benennen gibt ihr die Gelegenheit, den Punkt selbst anzusprechen.
 *
 * Und es sagt nie „du bist zu gut dafür" oder „die nehmen dich nicht".
 * Das erste ist Schmeichelei, das zweite eine Prognose, die wir nicht
 * treffen können.
 */

export type SeniorityLevel = "entry" | "junior" | "mid" | "senior" | "lead" | "unknown";

export type AlignmentStatus =
  | "aligned"
  | "stretch"
  | "entry_gap"
  | "potentially_overqualified"
  | "career_change"
  | "unclear";

export interface SeniorityAssessment {
  status: AlignmentStatus;
  userLevel: SeniorityLevel;
  jobLevel: SeniorityLevel;
  /** Was ein Arbeitgeber fragen könnte. Neutral formuliert. */
  riskReasons: string[];
  /** Was Nina die Person fragen sollte, um die Motivation zu belegen. */
  questions: string[];
  headline: string;
  confidence: number;
}

const RANG: Record<SeniorityLevel, number> = {
  entry: 0, junior: 1, mid: 2, senior: 3, lead: 4, unknown: -1,
};

const LABEL: Record<SeniorityLevel, string> = {
  entry: "Einstieg",
  junior: "Junior",
  mid: "Mittleres Niveau",
  senior: "Senior",
  lead: "Führung",
  unknown: "unbekannt",
};

/** Aus Jahren ein Niveau ableiten — grob, und das steht auch so da. */
export function levelFromYears(years: number | null): SeniorityLevel {
  if (years === null) return "unknown";
  if (years < 1) return "entry";
  if (years < 3) return "junior";
  if (years < 6) return "mid";
  if (years < 10) return "senior";
  return "lead";
}

export function levelFromTitle(title: string): SeniorityLevel {
  const t = title.toLowerCase();
  // Ohne führende Wortgrenze vor "leit": im Deutschen wird
  // zusammengesetzt, und "Teamleitung" ist ein Wort. Ein Muster mit
  // \bleitung\b findet "Leitung Logistik", aber nicht "Teamleitung" —
  // und die zweite Schreibweise ist die häufigere.
  if (/(head of|leiter\b|leiterin\b|leitung\b|director|\bvp\b|geschäftsführ|team ?lead)/.test(t)) return "lead";
  if (/\b(senior|sr\.|principal|staff|erfahren)\b/.test(t)) return "senior";
  if (/\b(junior|jr\.|einsteiger|trainee|praktik|werkstudent|azubi|auszubildend)\b/.test(t)) return "junior";
  if (/\b(berufseinsteiger|entry.level|absolvent)\b/.test(t)) return "entry";
  return "unknown";
}

export function assessSeniority(input: {
  userLevel: SeniorityLevel;
  jobLevel: SeniorityLevel;
  /** Hat die Person eine Motivation für den Wechsel bestätigt? */
  motivationConfirmed?: boolean;
  /** Deutet das Profil auf einen Branchen- oder Rollenwechsel hin? */
  careerChange?: boolean;
}): SeniorityAssessment {
  const { userLevel, jobLevel } = input;

  if (userLevel === "unknown" || jobLevel === "unknown") {
    return {
      status: "unclear",
      userLevel,
      jobLevel,
      riskReasons: [],
      questions: [],
      headline:
        userLevel === "unknown"
          ? "Dein Erfahrungsniveau ist noch nicht eingeschätzt."
          : "Die Anzeige nennt kein Erfahrungsniveau.",
      confidence: 0.2,
    };
  }

  const abstand = RANG[userLevel] - RANG[jobLevel];

  if (abstand >= 2) {
    return {
      status: input.careerChange ? "career_change" : "potentially_overqualified",
      userLevel,
      jobLevel,
      // Neutral formuliert: das sind Fragen, die entstehen können —
      // keine Vorhersage darüber, was ein Arbeitgeber tut.
      riskReasons: [
        "Dein Erfahrungsniveau liegt über der ausgeschriebenen Seniorität.",
        "Das kann erklärungsbedürftig sein — beim Gehalt und bei der Frage, wie lange du bleiben möchtest.",
      ],
      questions: [
        "Was reizt dich an dieser Rolle, obwohl sie unter deinem bisherigen Niveau ausgeschrieben ist?",
        "Welche Verantwortung möchtest du bewusst nicht mehr übernehmen?",
        "Was würde dich mehrere Jahre in dieser Rolle halten?",
        "Welche Gehaltsvorstellung wäre für dich hier realistisch?",
      ],
      headline: input.careerChange
        ? `Wechsel: ${LABEL[userLevel]} → ${LABEL[jobLevel]}`
        : `Dein Niveau liegt über der Ausschreibung (${LABEL[userLevel]} → ${LABEL[jobLevel]})`,
      confidence: 0.6,
    };
  }

  if (abstand <= -2) {
    return {
      status: "entry_gap",
      userLevel,
      jobLevel,
      riskReasons: [
        "Die Anzeige ist deutlich über deinem bisher belegten Niveau ausgeschrieben.",
      ],
      questions: [
        "Welche Aufgaben aus dieser Stelle hast du bereits in ähnlicher Form gemacht?",
        "Welche geforderte Erfahrung fehlt dir formal, obwohl du die Tätigkeit kennst?",
      ],
      headline: `Die Ausschreibung liegt über deinem belegten Niveau (${LABEL[userLevel]} → ${LABEL[jobLevel]})`,
      confidence: 0.6,
    };
  }

  if (abstand === -1) {
    return {
      status: "stretch",
      userLevel,
      jobLevel,
      riskReasons: [],
      questions: [
        "Welche Aufgaben aus dieser Stelle traust du dir bereits zu, welche wären neu?",
      ],
      headline: "Ein Schritt nach oben — erreichbar, wenn du die Lücke benennen kannst.",
      confidence: 0.6,
    };
  }

  return {
    status: "aligned",
    userLevel,
    jobLevel,
    riskReasons: [],
    questions: [],
    headline: "Das Erfahrungsniveau passt zur Ausschreibung.",
    confidence: 0.7,
  };
}

/**
 * Prüft, ob ein Text eine abwertende Formulierung enthält.
 *
 * Wird in den Tests benutzt und steht bewusst hier, damit die Liste
 * neben dem Code steht, den sie einschränkt.
 */
export const ABWERTEND =
  /\b(zu gut für|unter deinem niveau|wird dich (sicher )?ablehnen|keine chance|nicht ernst genommen|verschwendung)\b/i;
