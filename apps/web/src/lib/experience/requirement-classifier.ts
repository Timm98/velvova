/**
 * Was in einer Anforderungsliste wirklich steht.
 *
 * „Führerschein Klasse C" und „zwei Jahre Erfahrung" und „Teamgeist"
 * stehen in derselben Aufzählung und sind drei völlig verschiedene
 * Dinge:
 *
 *   Das erste ist eine formale Sperre. Ohne geht es nicht.
 *   Das zweite ist verhandelbar und oft anders belegbar.
 *   Das dritte ist Werbetext und sagt über die Stelle nichts.
 *
 * Ein Produkt, das alle drei gleich behandelt, filtert Menschen aus,
 * die die Stelle bekommen könnten — und lässt sie glauben, sie seien
 * nicht qualifiziert. Das ist das Erfahrungsparadox in seiner
 * technischen Form.
 *
 * Die Klassifikation ist regelbasiert und arbeitet auf dem
 * Originalwortlaut. Ein Modell könnte das flüssiger, aber niemand
 * könnte nachvollziehen, warum eine Anforderung als zwingend galt.
 */

export type RequirementType =
  | "legal_or_license"
  | "hard_technical"
  | "hard_language"
  | "hard_availability"
  | "experience"
  | "education"
  | "preferred"
  | "cultural_marketing_language"
  | "unclear";

export type RequirementStrength =
  | "mandatory"
  | "strongly_preferred"
  | "preferred"
  | "context_dependent"
  | "unknown";

export interface ClassifiedRequirement {
  text: string;
  type: RequirementType;
  strength: RequirementStrength;
  explicitOrInferred: "explicit" | "inferred";
  minimumYears: number | null;
  preferredYears: number | null;
  equivalentExperienceAllowed: boolean | null;
  degreeSubstitutionPossible: boolean | null;
  onboardingLearnable: boolean | null;
  confidence: number;
  /** Warum diese Einordnung. Steht in der Oberfläche neben dem Original. */
  rationale: string;
}

/** Formale Sperren. Hier hilft kein Argument und kein Beleg. */
const LIZENZ =
  /\b(führerschein|fahrerlaubnis|klasse\s?[a-z]{1,2}\b|approbation|gesundheitszeugnis|führungszeugnis|sachkundenachweis|befähigungsnachweis|staplerschein|schweißerprüfung|ausbildereignung|zulassung|driver'?s? licen[cs]e|work permit|arbeitserlaubnis)\b/i;

/** Formulierungen, die etwas ausdrücklich als Pflicht kennzeichnen. */
const PFLICHT =
  /\b(zwingend|zwingende|voraussetzung|erforderlich|unabdingbar|muss|müssen|setzen wir voraus|vorausgesetzt|required|must have|mandatory)\b/i;

/** Formulierungen, die etwas als Wunsch kennzeichnen. */
const WUNSCH =
  /\b(wünschenswert|von vorteil|idealerweise|bevorzugt|gerne|plus|nice to have|preferred|a plus|bonus|schön wäre)\b/i;

/** Wortwolken ohne Aussage über die Tätigkeit. */
const WERBUNG =
  /\b(teamgeist|teamplayer|hands[- ]?on|dynamisch|motiviert|engagiert|hohe eigenmotivation|leidenschaft|hands on mentalität|macher|können anpacken|belastbar|flexibel und|kommunikationsstark|proaktiv|self[- ]?starter|passion|rockstar|ninja)\b/i;

/**
 * „oder vergleichbare Qualifikation".
 *
 * Der Halbsatz steht oft daneben und wird überlesen — und genau er
 * entscheidet, ob sich jemand ohne den genannten Abschluss überhaupt
 * bewirbt.
 */
const ERSATZQUALIFIKATION =
  /\b(oder vergleichbar\w*|äquivalent\w*|or equivalent|vergleichbare qualifikation|entsprechende berufserfahrung)\b/i;

const SPRACHE = /\b(deutsch|englisch|französisch|spanisch|german|english)\b.{0,30}\b(kenntnis|niveau|sprach|fließend|verhandlungssicher|muttersprach|c1|c2|b2|fluent|native)/i;

const AUSBILDUNG =
  /\b(studium|abgeschlossene[sn]?\s+(studium|ausbildung)|bachelor|master|diplom|ausbildung als|berufsausbildung|degree|abitur)\b/i;

const VERFUEGBARKEIT =
  /\b(schicht|nachtdienst|wochenend|rufbereitschaft|bereitschaftsdienst|reisebereitschaft|vollzeit|teilzeit|ab sofort|kurzfristig verfügbar)\b/i;

/**
 * Jahre aus dem Text lesen.
 *
 * „mindestens 3 Jahre", „3+ Jahre", „drei Jahre", „2-4 Jahre". Die
 * ausgeschriebenen Zahlen sind wichtig: sie kommen in deutschen
 * Anzeigen häufig vor, und ein Muster nur für Ziffern übersieht sie.
 */
const ZAHLWORT: Record<string, number> = {
  ein: 1, eine: 1, einem: 1, zwei: 2, drei: 3, vier: 4, fünf: 5,
  sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10,
};

export function extractYears(text: string): { minimum: number | null; preferred: number | null } {
  const spanne = text.match(/(\d+)\s*[-–bis]{1,3}\s*(\d+)\s*jahr/i);
  if (spanne) return { minimum: Number(spanne[1]), preferred: Number(spanne[2]) };

  const ziffer = text.match(/(\d+)\s*\+?\s*jahr/i);
  if (ziffer) return { minimum: Number(ziffer[1]), preferred: null };

  const wort = text.match(/\b(ein|eine|einem|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\s+jahr/i);
  if (wort) return { minimum: ZAHLWORT[wort[1]!.toLowerCase()] ?? null, preferred: null };

  return { minimum: null, preferred: null };
}

export function classifyRequirement(
  text: string,
  kind: "must" | "nice" | string = "must",
): ClassifiedRequirement {
  const t = text.trim();
  const jahre = extractYears(t);

  const gemeinsam = {
    text: t,
    minimumYears: jahre.minimum,
    preferredYears: jahre.preferred,
    explicitOrInferred: (PFLICHT.test(t) || WUNSCH.test(t) ? "explicit" : "inferred") as
      | "explicit"
      | "inferred",
  };

  // Reihenfolge ist Absicht: die formale Sperre schlägt alles andere.
  // Eine Lizenz, die als „wünschenswert" formuliert ist, ist trotzdem
  // eine Lizenz — aber dann eben eine gewünschte, keine zwingende.
  if (LIZENZ.test(t)) {
    return {
      ...gemeinsam,
      type: "legal_or_license",
      strength: WUNSCH.test(t) ? "preferred" : "mandatory",
      equivalentExperienceAllowed: false,
      degreeSubstitutionPossible: false,
      onboardingLearnable: false,
      confidence: 0.85,
      rationale:
        "Eine formale Berechtigung. Sie lässt sich nicht durch Erfahrung ersetzen — " +
        "erwerben aber schon.",
    };
  }

  if (WERBUNG.test(t) && !PFLICHT.test(t)) {
    return {
      ...gemeinsam,
      type: "cultural_marketing_language",
      strength: "context_dependent",
      equivalentExperienceAllowed: null,
      degreeSubstitutionPossible: null,
      onboardingLearnable: null,
      confidence: 0.7,
      rationale:
        "Werbetext ohne prüfbare Aussage über die Tätigkeit. Nichts, woran du " +
        "scheitern könntest.",
    };
  }

  if (SPRACHE.test(t)) {
    return {
      ...gemeinsam,
      type: "hard_language",
      strength: WUNSCH.test(t) ? "preferred" : "mandatory",
      equivalentExperienceAllowed: false,
      degreeSubstitutionPossible: false,
      onboardingLearnable: false,
      confidence: 0.8,
      rationale: "Eine Sprachanforderung. Im Gespräch überprüfbar, im Onboarding selten aufholbar.",
    };
  }

  if (VERFUEGBARKEIT.test(t)) {
    return {
      ...gemeinsam,
      type: "hard_availability",
      strength: WUNSCH.test(t) ? "preferred" : "mandatory",
      equivalentExperienceAllowed: false,
      degreeSubstitutionPossible: false,
      onboardingLearnable: false,
      confidence: 0.75,
      rationale: "Eine Bedingung an Zeit oder Ort. Entweder es passt in dein Leben oder nicht.",
    };
  }

  if (AUSBILDUNG.test(t)) {
    return {
      ...gemeinsam,
      type: "education",
      strength: WUNSCH.test(t) ? "preferred" : PFLICHT.test(t) ? "mandatory" : "strongly_preferred",
      equivalentExperienceAllowed: true,
      // Zwei Regeln für dieselbe Frage sind eine zu viel: die erste
      // Fassung prüfte das Feld mit einem breiteren Muster als den
      // erklärenden Satz. Ergebnis: „Alternative möglich" im Datenfeld,
      // „steht nicht dabei" im Text daneben.
      degreeSubstitutionPossible: ERSATZQUALIFIKATION.test(t),
      onboardingLearnable: false,
      confidence: 0.75,
      rationale: ERSATZQUALIFIKATION.test(t)
        ? "Ein Abschluss — ausdrücklich mit gleichwertiger Qualifikation als Alternative."
        : "Ein Abschluss. Häufig ist Berufserfahrung eine akzeptierte Alternative, auch wenn es nicht dasteht.",
    };
  }

  if (jahre.minimum !== null || /\b(erfahrung|berufserfahrung|experience)\b/i.test(t)) {
    return {
      ...gemeinsam,
      type: "experience",
      strength: WUNSCH.test(t) ? "preferred" : PFLICHT.test(t) ? "mandatory" : "strongly_preferred",
      equivalentExperienceAllowed: true,
      degreeSubstitutionPossible: null,
      onboardingLearnable: (jahre.minimum ?? 0) <= 1,
      confidence: 0.7,
      rationale:
        jahre.minimum !== null
          ? `Erfahrung in Jahren gemessen (${jahre.minimum}). Was zählt, ist meist die Tätigkeit, nicht die Dauer.`
          : "Erfahrung ohne Jahresangabe. Übertragbare Tätigkeiten zählen hier oft mit.",
    };
  }

  if (kind === "nice" || WUNSCH.test(t)) {
    return {
      ...gemeinsam,
      type: "preferred",
      strength: "preferred",
      equivalentExperienceAllowed: true,
      degreeSubstitutionPossible: null,
      onboardingLearnable: true,
      confidence: 0.65,
      rationale: "Ausdrücklich als Wunsch formuliert. Kein Ausschlussgrund.",
    };
  }

  if (/\b(kenntnis|beherrsch|sicher im umgang|erfahrung mit|kenntnisse in)\b/i.test(t)) {
    return {
      ...gemeinsam,
      type: "hard_technical",
      strength: PFLICHT.test(t) ? "mandatory" : "strongly_preferred",
      equivalentExperienceAllowed: true,
      degreeSubstitutionPossible: null,
      onboardingLearnable: true,
      confidence: 0.65,
      rationale: "Eine fachliche Fähigkeit. Vergleichbare Werkzeuge zählen oft mit.",
    };
  }

  return {
    ...gemeinsam,
    type: "unclear",
    strength: "unknown",
    equivalentExperienceAllowed: null,
    degreeSubstitutionPossible: null,
    onboardingLearnable: null,
    confidence: 0.3,
    rationale: "Nicht eindeutig einzuordnen. Im Zweifel im Gespräch nachfragen.",
  };
}

/**
 * Was von einer Anforderungsliste wirklich blockiert.
 *
 * Die Zahl, die zählt, ist nicht „12 Anforderungen", sondern „2 davon
 * sind echte Sperren". Der Unterschied entscheidet darüber, ob sich
 * jemand bewirbt.
 */
export function summariseRequirements(reqs: ClassifiedRequirement[]): {
  blocking: ClassifiedRequirement[];
  negotiable: ClassifiedRequirement[];
  noise: ClassifiedRequirement[];
  summary: string;
} {
  const blocking = reqs.filter(
    (r) => r.strength === "mandatory" && (r.type === "legal_or_license" || r.type === "hard_language" || r.type === "hard_availability"),
  );
  const noise = reqs.filter((r) => r.type === "cultural_marketing_language");
  const negotiable = reqs.filter((r) => !blocking.includes(r) && !noise.includes(r));

  const summary =
    blocking.length === 0
      ? `Keine formale Sperre. ${negotiable.length} Anforderungen sind fachlich und meist verhandelbar.`
      : `${blocking.length} ${blocking.length === 1 ? "Anforderung ist" : "Anforderungen sind"} eine echte Sperre, ` +
        `${negotiable.length} sind fachlich und meist verhandelbar.`;

  return { blocking, negotiable, noise, summary };
}
