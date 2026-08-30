/**
 * Eine Nachricht an einen Menschen, den man um Rat bittet.
 *
 * Viele zögern hier, weil sie glauben, nur selbst zu profitieren und
 * die andere Person zu belasten. Das stimmt oft nicht: über die eigene
 * Arbeit gefragt zu werden ist für die meisten eher angenehm als
 * lästig.
 *
 * Das ist ein Perspektivwechsel, keine Erfolgsversprechen. Es steht
 * nirgends „70 % antworten" — das wüssten wir nicht, und es wäre der
 * Anfang einer Manipulation.
 *
 * Vier Regeln für jeden Entwurf:
 *
 *   **Kurz.** Wer eine Bildschirmseite bekommt, antwortet nicht.
 *   **Konkret.** „Kannst du mir helfen" ist keine Frage.
 *   **Klein.** Eine Frage, nicht fünf.
 *   **Absagbar.** Ohne einfachen Ausweg entsteht Druck, und Druck
 *   erzeugt Schweigen.
 */

export type Relationship =
  | "warm_intro"
  | "former_colleague"
  | "alumni"
  | "team_member"
  | "similar_path"
  | "recruiter"
  | "hiring_manager"
  | "event_contact";

export interface MessageInput {
  contactName: string;
  relationship: Relationship;
  /** Der konkrete Bezug — woher die Person sie kennt oder was auffiel. */
  context: string;
  /** Die eine Frage. */
  question: string;
  /** Wonach die Person selbst gerade sucht. */
  ownSituation: string;
  /** Optionaler Zeitrahmen für ein Gespräch. */
  timeframe?: string;
}

export interface MessageDraft {
  text: string;
  warnings: string[];
  /** Zeichen. Über 700 antwortet fast niemand. */
  length: number;
}

const ANREDE: Record<Relationship, (name: string) => string> = {
  warm_intro: (n) => `Hallo ${n},`,
  former_colleague: (n) => `Hallo ${n},`,
  alumni: (n) => `Hallo ${n},`,
  team_member: (n) => `Hallo ${n},`,
  similar_path: (n) => `Hallo ${n},`,
  recruiter: (n) => `Guten Tag ${n},`,
  hiring_manager: (n) => `Guten Tag ${n},`,
  event_contact: (n) => `Hallo ${n},`,
};

/** Formulierungen, die Druck erzeugen oder etwas vortäuschen. */
const UNZULAESSIG: { muster: RegExp; hinweis: string }[] = [
  {
    muster: /\b(nur ganz kurz|nur eine minute|dauert nur)\b/i,
    hinweis: "„Dauert nur kurz“ nimmt der anderen Person die Einschätzung ab.",
  },
  {
    muster: /\b(ich wäre dir sehr dankbar|es würde mir wirklich viel bedeuten|bitte bitte)\b/i,
    hinweis: "Zu viel Dankbarkeit im Voraus erzeugt Verpflichtung.",
  },
  {
    muster: /\b(kannst du mir (einen job|eine stelle) )\b/i,
    hinweis: "Eine direkte Jobbitte im Erstkontakt überfordert die Bitte.",
  },
  {
    muster: /\b(dringend|schnellstmöglich|so bald wie möglich)\b/i,
    hinweis: "Eigene Dringlichkeit ist kein Grund für die andere Person.",
  },
];

export function buildMessage(input: MessageInput): MessageDraft {
  const anrede = ANREDE[input.relationship](input.contactName);
  const zeitrahmen = input.timeframe
    ? ` Vielleicht ${input.timeframe}?`
    : " Vielleicht in den nächsten Wochen?";

  /*
   * Der Ausweg am Ende ist kein Höflichkeitsfloskel. Er ist der Grund,
   * warum diese Bitte keine Verpflichtung erzeugt — und deshalb steht
   * er in jedem Entwurf, ohne Ausnahme.
   */
  const text = [
    anrede,
    "",
    `${input.context.trim().replace(/\.?$/, ".")}`,
    "",
    `${input.ownSituation.trim().replace(/\.?$/, ".")} ${input.question.trim().replace(/\?*$/, "?")}`,
    "",
    `Ein kurzer Austausch per Nachricht reicht mir völlig.${zeitrahmen}`,
    "Falls es gerade nicht passt, ist das selbstverständlich in Ordnung.",
  ].join("\n");

  const warnings: string[] = [];
  for (const regel of UNZULAESSIG) {
    if (regel.muster.test(text)) warnings.push(regel.hinweis);
  }
  if (text.length > 700) {
    warnings.push("Länger als eine halbe Bildschirmseite. Kürzere Nachrichten werden eher beantwortet.");
  }
  if (!input.context.trim()) {
    warnings.push("Ohne konkreten Bezug wirkt die Nachricht wie eine Serienmail.");
  }

  return { text, warnings, length: text.length };
}

/**
 * Der Perspektivwechsel — als Angebot, nicht als Behauptung.
 *
 * Kein Prozentsatz, keine Erfolgsquote. Was hier steht, muss auch dann
 * stimmen, wenn niemand antwortet.
 */
export const RECIPROCITY_NOTE =
  "Über die eigene Arbeit gefragt zu werden ist für viele eher angenehm als lästig — " +
  "besonders, wenn die Frage konkret ist und leicht zu beantworten. Eine Antwort ist " +
  "damit nicht sicher, und ein Schweigen sagt nichts über dich.";

/**
 * Was das Produkt beim Networking niemals tut.
 *
 * Steht als Liste im Code, weil sie im Test geprüft wird — und weil
 * eine Regel, die nur in einem Dokument steht, irgendwann gebrochen wird.
 */
export const NETWORKING_VERBOTE = [
  "Keine Kontaktadressen erraten oder aus fremden Seiten auslesen.",
  "Keine automatische Versendung — die Person drückt selbst auf Senden.",
  "Keine Serienmail an mehrere Kontakte.",
  "Keine Nachverfolgung, ob eine Nachricht gelesen wurde.",
  "Keine Erfolgsquote versprechen.",
] as const;
