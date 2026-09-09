/**
 * ══════════════════════════════════════════════════════════════════
 * Wer hat welche Übersetzung gelesen
 * ══════════════════════════════════════════════════════════════════
 *
 * Der Grund für diese Datei ist ein einziger Satz, den sonst niemand
 * mehr sagen könnte: „Diese Einwilligung ist von jemandem gelesen
 * worden, der die Sprache spricht."
 *
 * Ohne ein solches Register sind alle sieben Kataloge im Code gleich —
 * dieselbe Form, dieselbe Vollständigkeit, dieselbe Typprüfung. Man
 * sieht ihnen nicht an, dass zwei davon von Menschen stammen, die
 * diese Sprachen sprechen, und fünf von einem Modell. Und was man
 * nicht sieht, prüft irgendwann niemand mehr.
 *
 * ── Warum das mehr ist als Buchführung ──────────────────────────
 *
 * `consent` enthält Einwilligungen. Eine Einwilligung, deren Wortlaut
 * die betroffene Person nicht richtig verstanden hat, ist nach DSGVO
 * keine wirksame Einwilligung — sie ist keine „unmissverständlich
 * abgegebene Willensbekundung in informierter Weise". Ein
 * Übersetzungsfehler ist dort also kein Schönheitsfehler, sondern ein
 * fehlender Rechtsgrund für die Verarbeitung.
 *
 * Das ist kein Rechtsrat, sondern der Grund, warum der Stand hier
 * steht und nicht in jemandes Erinnerung.
 *
 * ── Was „geprüft" heissen muss ──────────────────────────────────
 *
 * Nicht „durchgelesen und für gut befunden". Sondern: Eine Person,
 * die die Sprache spricht, hat den Katalog durchgesehen — und für die
 * Abschnitte `consent` und `studio` jemand, der die rechtliche
 * Tragweite beurteilen kann. Wer nur das eine hat, trägt
 * `sprachlich-geprueft` ein und nicht `geprueft`.
 */

export type Uebersetzungsstand =
  /** Von Menschen geschrieben oder vollständig gegengelesen, einschliesslich der Rechtstexte. */
  | "geprueft"
  /** Sprachlich gegengelesen, die Rechtstexte aber noch nicht. */
  | "sprachlich-geprueft"
  /** Maschinell übersetzt, von niemandem gegengelesen. */
  | "ungeprueft";

export interface Prüfeintrag {
  stand: Uebersetzungsstand;
  /** Wer, in welcher Rolle. Leer, solange niemand gelesen hat. */
  gelesenVon?: string;
  /** ISO-Datum der Durchsicht. */
  am?: string;
  /** Was beim nächsten Mal zuerst zu prüfen ist. */
  hinweis?: string;
}

/**
 * Stand vom 9. September 2026.
 *
 * Deutsch und Englisch stammen aus der ursprünglichen Fassung des
 * Produkts und sind gewachsen — sie werden hier als geprüft geführt,
 * weil sie über Monate von Menschen geschrieben und benutzt wurden.
 *
 * Die fünf neuen sind an einem Abend entstanden und von niemandem
 * gegengelesen. Genau so stehen sie hier.
 */
export const UEBERSETZUNGSSTAND: Readonly<Record<string, Prüfeintrag>> = {
  de: { stand: "geprueft", gelesenVon: "Ursprungsfassung des Produkts" },
  en: { stand: "geprueft", gelesenVon: "Ursprungsfassung des Produkts" },

  fr: {
    stand: "ungeprueft",
    am: "2026-09-09",
    hinweis:
      "Maschinell übersetzt. Zuerst `consent` (Einwilligungen) und `studio` " +
      "(« étayé » gegen « non étayé ») prüfen.",
  },
  es: {
    stand: "ungeprueft",
    am: "2026-09-09",
    hinweis:
      "Maschinell übersetzt. Zuerst `consent` und `studio` prüfen; dort trägt die " +
      "Unterscheidung «avalado» / «sin aval» das Produktversprechen.",
  },
  it: {
    stand: "ungeprueft",
    am: "2026-09-09",
    hinweis:
      "Maschinell übersetzt. Zuerst `consent` und `studio` prüfen (« documentato » gegen " +
      "« non documentato »).",
  },
  nl: {
    stand: "ungeprueft",
    am: "2026-09-09",
    hinweis:
      "Maschinell übersetzt. Zuerst `consent` und `studio` prüfen («onderbouwd» gegen «niet " +
      "onderbouwd»).",
  },
  pl: {
    stand: "ungeprueft",
    am: "2026-09-09",
    hinweis:
      "Maschinell übersetzt. Zuerst `consent` und `studio` prüfen. Ausserdem die Anredeform: " +
      "durchgehend „du“ wie im deutschen Original — im polnischen Usus für förmliche Texte " +
      "unüblich.",
  },
};

/**
 * Darf in dieser Sprache eine Einwilligung eingeholt werden?
 *
 * Die Frage ist absichtlich enger als „gibt es Texte". Texte gibt es
 * für alle sieben; ob der Wortlaut einer Einwilligung trägt, ist eine
 * andere Frage — und sie wird hier beantwortet, nicht an der Stelle,
 * an der die Einwilligung angezeigt wird.
 *
 * `sprachlich-geprueft` genügt dafür nicht. Wer den Satz flüssig
 * findet, hat damit noch nicht gesagt, dass er rechtlich dasselbe
 * bedeutet wie das Original.
 */
export function darfEinwilligungEinholen(sprache: string): boolean {
  return UEBERSETZUNGSSTAND[sprache]?.stand === "geprueft";
}

/**
 * Die Sprachen, deren Oberfläche man guten Gewissens anbietet.
 *
 * Alle, für die es Texte gibt — auch die ungeprüften. Eine
 * maschinelle Übersetzung ist für „Speichern" und „Zurück" besser als
 * eine fremde Sprache, und ein Fehler dort kostet einen Moment
 * Verwirrung, keinen Rechtsgrund.
 *
 * Die Grenze verläuft nicht zwischen den Sprachen, sondern zwischen
 * den Abschnitten: Bedienung ja, Einwilligung erst nach Prüfung.
 */
export function istOberflaecheAnbietbar(sprache: string): boolean {
  return sprache in UEBERSETZUNGSSTAND;
}
