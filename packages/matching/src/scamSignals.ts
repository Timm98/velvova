/**
 * Warnzeichen in einer Stellenanzeige.
 *
 * Der Unterschied zu allen anderen Bewertungen in diesem Produkt: hier
 * geht es nicht um Passung, sondern um Schaden. Ein Vorschussbetrug
 * kostet eine arbeitssuchende Person mehrere hundert Euro, die sie
 * gerade nicht hat, und eine zu früh herausgegebene Ausweiskopie kostet
 * sie unter Umständen jahrelang.
 *
 * Drei Regeln, die diesen Modul von einem Betrugsdetektor unterscheiden:
 *
 * **Das Wort „Betrug" fällt nie.** Wir können aus der Ferne nicht
 * feststellen, ob eine Anzeige betrügerisch ist. Wir können sagen, was
 * in ihr steht — und was darin ungewöhnlich ist.
 *
 * **Kein Modell entscheidet.** Jedes Signal hier ist eine Regel mit
 * einer Fundstelle im Text. Eine Modellausgabe „das wirkt unseriös"
 * wäre für die Person nicht überprüfbar und für uns nicht belegbar.
 *
 * **Die Person entscheidet.** Das Ergebnis ist ein Hinweis mit Zitat,
 * kein Filter. Eine ausgeblendete Stelle kann niemand prüfen.
 */

export type VerificationLevel =
  | "verified_source"
  | "normal_confidence"
  | "additional_verification_recommended";

export interface ScamSignal {
  key: string;
  /** In ganzen Sätzen, für die Person — nicht für ein Protokoll. */
  label: string;
  severity: "hoch" | "mittel" | "hinweis";
  /** Die Stelle im Text, auf die sich das Signal stützt. */
  evidence: string;
  /** Was die Person konkret tun kann. */
  advice: string;
}

export interface ScamAssessment {
  level: VerificationLevel;
  signals: ScamSignal[];
  /** Ein Satz, der über der Anzeige stehen kann. */
  summary: string;
}

interface Regel {
  key: string;
  label: string;
  severity: ScamSignal["severity"];
  patterns: RegExp[];
  advice: string;
}

/**
 * Die Muster stammen aus dokumentierten Betrugsmaschen im
 * Bewerbungsumfeld, nicht aus Vermutungen.
 */
const REGELN: Regel[] = [
  {
    key: "upfront_payment",
    label: "Die Anzeige verlangt eine Zahlung von dir.",
    severity: "hoch",
    patterns: [
      /\b(gebühr|kaution|vorkasse|anzahlung|bearbeitungsgebühr|vermittlungsgebühr|schulungsgebühr)\b/i,
      /\b(überweise|zahle|zahlung von|bezahle)\b[^.]{0,40}\b(vorab|zuerst|im voraus)\b/i,
      /\b(registration fee|processing fee|training fee|deposit required)\b/i,
    ],
    advice:
      "Ein Arbeitgeber verlangt kein Geld für eine Bewerbung, eine Schulung oder Arbeitsmittel. " +
      "Überweise nichts.",
  },
  {
    key: "equipment_purchase",
    label: "Du sollst Arbeitsmittel selbst kaufen oder vorstrecken.",
    severity: "hoch",
    patterns: [
      /\b(laptop|ausrüstung|equipment|software|lizenz)\b[^.]{0,50}\b(selbst (kaufen|anschaffen|erwerben)|auf eigene kosten|vorstrecken|erstatten wir)\b/i,
      /\b(purchase (your own|the) equipment|reimburse you (later|after))\b/i,
    ],
    advice: "Lass dir die Erstattung schriftlich zusichern, bevor du etwas kaufst — oder gar nicht.",
  },
  {
    key: "sensitive_data_early",
    label: "Sensible Daten werden vor einem Gespräch verlangt.",
    severity: "hoch",
    patterns: [
      /\b(kontonummer|iban|bankverbindung|kreditkarte|sozialversicherungsnummer|steuer-?id|ausweiskopie|personalausweis|reisepass)\b/i,
      /\b(bank details|social security number|passport copy|id card copy)\b/i,
    ],
    advice:
      "Bankverbindung, Ausweis und Sozialversicherungsnummer braucht ein Arbeitgeber erst nach " +
      "der Zusage, für den Arbeitsvertrag. Nicht vorher.",
  },
  {
    key: "money_handling",
    label: "Es geht um das Weiterleiten von Geld oder Paketen.",
    severity: "hoch",
    patterns: [
      /*
       * Zwei Dinge, an denen die erste Fassung gescheitert ist:
       *
       * Zwischen Gegenstand und Handlung steht ein halber Satz —
       * "Du empfängst Gelder und leitest sie weiter."
       *
       * Und das Verb ist trennbar. Im Deutschen wandert die Vorsilbe
       * ans Satzende: nicht "weiterleiten", sondern "leitest … weiter".
       * Ein Muster, das nur die zusammengeschriebene Form kennt, findet
       * genau die Formulierung nicht, die tatsächlich benutzt wird.
       */
      /\b(gelder?|zahlungen|beträge)\b[^.]{0,50}\b(weiter\s?leit|transferier|überweis)/i,
      /\b(gelder?|zahlungen|beträge)\b[^.]{0,50}\bleit\w*\b[^.]{0,20}\bweiter\b/i,
      /\b(pakete?|sendungen)\b[^.]{0,50}\b(weiter\s?leit|umpack|weiter\s?send)/i,
      /\b(pakete?|sendungen)\b[^.]{0,50}\b(leit|send|schick)\w*\b[^.]{0,20}\bweiter\b/i,
      /\b(zahlungsabwickl|finanzagent|paketagent|money mule)\b/i,
      /\b(receive and forward (payments|packages))\b/i,
    ],
    advice:
      "Geld oder Pakete über das eigene Konto weiterzuleiten ist in aller Regel Geldwäsche — " +
      "auch dann, wenn man nichts davon wusste. Finger weg.",
  },
  {
    key: "messenger_only",
    label: "Das Gespräch soll nur über einen Messenger laufen.",
    severity: "mittel",
    patterns: [
      /\b(nur|ausschließlich|only)\b[^.]{0,30}\b(whatsapp|telegram|signal)\b/i,
      // "Melde dich gern per WhatsApp" — zwischen Aufforderung und
      // Kanal steht oft ein Füllwort.
      /\b(melde dich|schreib(e)? (uns|mir)|kontaktiere uns)\b[^.]{0,25}\b(whatsapp|telegram)\b/i,
      /\b(interview (via|on) (telegram|whatsapp))\b/i,
    ],
    advice:
      "Ein Vorstellungsgespräch, das nur im Chat stattfindet und nie mit einer Person, ist ein " +
      "Warnzeichen. Bitte um ein Telefonat oder ein Video.",
  },
  {
    key: "unrealistic_pay",
    label: "Das Verdienstversprechen ist auffällig hoch.",
    severity: "mittel",
    patterns: [
      /\b(\d{3,4})\s*(€|eur|euro)\s*(pro|am|je)\s*(tag|day)\b/i,
      /\b(bis zu\s*)?\d{4,}\s*(€|eur|euro)\s*(pro|die|je)\s*woche\b/i,
      /\b(schnell(es)? geld|leicht verdient|ohne vorkenntnisse.{0,20}\d{4,}\s*(€|eur))\b/i,
    ],
    advice:
      "Vergleiche die Angabe mit üblichen Gehältern in diesem Beruf. Ein Versprechen weit " +
      "darüber ist selten ein besonders guter Arbeitgeber.",
  },
  {
    key: "no_interview",
    label: "Eine Zusage ohne Gespräch wird in Aussicht gestellt.",
    severity: "mittel",
    patterns: [
      /\b(ohne (vorstellungsgespräch|bewerbungsgespräch|interview))\b/i,
      /\b(sofortige zusage|sofort einstellung|direkt eingestellt ohne)\b/i,
      /\b(no interview (required|needed)|hired immediately)\b/i,
    ],
    advice: "Ein Arbeitgeber, der niemanden kennenlernen will, sucht selten Mitarbeitende.",
  },
  {
    key: "free_mail_contact",
    label: "Der Kontakt läuft über eine private Freemail-Adresse.",
    severity: "hinweis",
    patterns: [
      /\b[\w.+-]+@(gmail|googlemail|gmx|web|yahoo|hotmail|outlook|mail|proton(mail)?)\.(com|de|net|me)\b/i,
    ],
    advice:
      "Seriöse Unternehmen schreiben in der Regel von ihrer eigenen Domäne. Prüfe, ob die " +
      "Adresse zum Unternehmen passt.",
  },
  {
    key: "urgency",
    label: "Es wird Eile erzeugt.",
    severity: "hinweis",
    patterns: [
      /\b(nur heute|nur noch heute|letzte chance|sofort zuschlagen|melde dich sofort)\b/i,
      /\b(act now|limited spots|apply within 24 hours)\b/i,
    ],
    advice: "Zeitdruck ist ein Verkaufsmittel. Lass dich davon nicht zu einer Zusage drängen.",
  },
];

export interface ScamInput {
  title: string;
  description: string;
  companyName: string;
  /** Die Adresse der Originalanzeige, falls vorhanden. */
  originalUrl: string | null;
  /** Stammt die Anzeige direkt vom Arbeitgeber? */
  fromEmployerFeed: boolean;
  /** Ist die Domäne des Arbeitgebers verifiziert? */
  employerDomainVerified: boolean;
}

/** Ein kurzer Ausschnitt um die Fundstelle. Nie der ganze Text. */
function ausschnitt(text: string, treffer: RegExpMatchArray): string {
  const index = treffer.index ?? 0;
  const von = Math.max(0, index - 40);
  const bis = Math.min(text.length, index + treffer[0].length + 40);
  return `${von > 0 ? "…" : ""}${text.slice(von, bis).replace(/\s+/g, " ").trim()}${bis < text.length ? "…" : ""}`;
}

export function assessScamSignals(input: ScamInput): ScamAssessment {
  const text = `${input.title}\n${input.description}`;
  const signals: ScamSignal[] = [];

  for (const regel of REGELN) {
    for (const pattern of regel.patterns) {
      const treffer = text.match(pattern);
      if (!treffer) continue;
      signals.push({
        key: regel.key,
        label: regel.label,
        severity: regel.severity,
        evidence: ausschnitt(text, treffer),
        advice: regel.advice,
      });
      break; // Ein Signal je Regel reicht.
    }
  }

  // Kein HTTPS ist heute ungewöhnlich genug, um es zu erwähnen — aber
  // kein Grund für sich allein.
  if (input.originalUrl?.startsWith("http://")) {
    signals.push({
      key: "no_https",
      label: "Die Originalanzeige liegt auf einer unverschlüsselten Seite.",
      severity: "hinweis",
      evidence: input.originalUrl,
      advice: "Gib auf dieser Seite keine persönlichen Daten ein.",
    });
  }

  const schwer = signals.filter((s) => s.severity === "hoch").length;
  const mittel = signals.filter((s) => s.severity === "mittel").length;

  /*
   * Die Einstufung.
   *
   * Ein schweres Signal reicht — bei "überweise eine Gebühr" gibt es
   * nichts abzuwägen. Zwei mittlere ebenfalls: einzeln haben sie
   * harmlose Erklärungen, zusammen selten.
   *
   * `verified_source` verlangt eine verifizierte Arbeitgeberdomäne UND
   * ein sauberes Bild. Eine direkte Quelle allein genügt nicht: auch
   * ein echtes Unternehmen kann eine schlecht formulierte Anzeige
   * schalten, und dann soll der Hinweis trotzdem stehen.
   */
  const level: VerificationLevel =
    schwer > 0 || mittel >= 2
      ? "additional_verification_recommended"
      : input.employerDomainVerified && input.fromEmployerFeed && signals.length === 0
        ? "verified_source"
        : "normal_confidence";

  return { level, signals, summary: zusammenfassung(level, signals) };
}

function zusammenfassung(level: VerificationLevel, signals: ScamSignal[]): string {
  if (level === "verified_source") {
    return "Die Anzeige kommt direkt von einem Arbeitgeber, dessen Domäne wir geprüft haben.";
  }

  if (level === "normal_confidence") {
    return signals.length === 0
      ? "Nichts Auffälliges in der Anzeige."
      : `${signals.length === 1 ? "Ein Hinweis" : `${signals.length} Hinweise`} zum Nachlesen — nichts davon ist für sich genommen ein Problem.`;
  }

  const schwer = signals.filter((s) => s.severity === "hoch");
  return schwer.length > 0
    ? `Prüfe diese Anzeige genauer: ${schwer[0]!.label.replace(/\.$/, "")}.`
    : "Prüfe diese Anzeige genauer, bevor du persönliche Daten herausgibst.";
}
