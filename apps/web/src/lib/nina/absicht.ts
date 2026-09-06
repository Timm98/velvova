/**
 * Was jemand von Nina will.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das eine Regel ist und kein Modellaufruf
 * ══════════════════════════════════════════════════════════════
 *
 * Die Absicht entscheidet, was mit einer Nachricht passiert — ob sie
 * ins Profil schreibt, eine Suche auslöst oder nur beantwortet wird.
 * Ein Modell, das diese Weiche stellt, stellt sie bei derselben
 * Eingabe zweimal verschieden, und niemand kann nachvollziehen,
 * warum eine Angabe einmal gespeichert wurde und einmal nicht.
 *
 * Die Regeln hier sind bewusst zurückhaltend: Im Zweifel
 * `unterhaltung`. Eine falsch erkannte Absicht schreibt etwas ins
 * Profil, das niemand sagen wollte; eine nicht erkannte kostet eine
 * Rückfrage.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das für Sprache und Text dasselbe ist
 * ══════════════════════════════════════════════════════════════
 *
 * Der Sprachmodus wandelt Ton in Text und schickt denselben Text
 * hierher. Es gibt keine zweite Absichtserkennung für Gesprochenes —
 * sonst gäbe es zwei Ninas, die sich unterschiedlich verhalten, und
 * der Unterschied fiele erst auf, wenn jemand beides benutzt.
 */

export type Absicht =
  /** Ein gewöhnlicher Satz. Nina antwortet, sonst nichts. */
  | "unterhaltung"
  /** Enthält Angaben über die Person — Extraktion läuft. */
  | "profil_angabe"
  /** Fragt nach dem eigenen Profil. */
  | "profil_frage"
  /** Will Stellen sehen. */
  | "jobsuche"
  /** Fragt, warum eine Stelle vorgeschlagen wurde. */
  | "match_erklaerung"
  /** Bewertet einen Vorschlag. */
  | "rueckmeldung"
  /** Will eine Handlung — bewerben, speichern, schreiben. */
  | "handlung";

export type Erkennung = {
  absicht: Absicht;
  /** Woran es erkannt wurde — für das Protokoll und die Fehlersuche. */
  grund: string;
};

/*
 * Zahlen mit Geldbezug, Stundenangaben, Entfernungen — Ziffern UND
 * Zahlwörter.
 *
 * „Zwei Tage Homeoffice" ist im gesprochenen Satz der Normalfall. Wer
 * nur auf Ziffern prüft, erkennt die Hälfte der Angaben nicht — und
 * zwar genau die Hälfte, die aus dem Sprachmodus kommt, weil
 * Spracherkennung kleine Zahlen ausschreibt.
 */
const ZAHLWORT = "ein|eine|einen|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn";
const ZAHLANGABE = new RegExp(
  `\\b\\d{1,3}([.\\s]?\\d{3})?\\s*(€|eur|euro|k\\b|tsd|brutto|netto)` +
    `|\\b(\\d{1,2}|${ZAHLWORT})\\s*(tage?|stunden|std|km|minuten|min)\\b`,
  "i",
);

const MUSTER: { absicht: Absicht; muster: RegExp; grund: string }[] = [
  {
    absicht: "match_erklaerung",
    muster: /\bwarum\b.*\b(passt|vorgeschlagen|zeigst|empfiehlst|match)\b|\bwieso\b.*\bstelle\b/i,
    grund: "fragt nach der Begründung eines Vorschlags",
  },
  {
    absicht: "rueckmeldung",
    muster: /\b(passt nicht|interessiert mich nicht|will ich nicht|zu weit weg|zu wenig gehalt|nichts für mich|gefällt mir)\b/i,
    grund: "bewertet einen Vorschlag",
  },
  {
    absicht: "handlung",
    muster: /\b(bewirb|bewerbung.*(schick|senden|abschicken)|merk dir|speicher|schreib.*(nachricht|anschreiben))\b/i,
    grund: "verlangt eine Handlung",
  },
  {
    absicht: "jobsuche",
    muster: /\b(zeig|such|find|gibt es).*(stelle|job|position|angebot)|\bwas gibt es\b/i,
    grund: "will Stellen sehen",
  },
  {
    absicht: "profil_frage",
    muster: /\bwas (weisst|weißt|weiss|weiß) du (über|von) (mir|mich)\b|\bmein profil\b|\bwas hast du (gespeichert|notiert)\b/i,
    grund: "fragt nach dem eigenen Profil",
  },
];

export function absichtErkennen(text: string): Erkennung {
  const t = text.trim();
  if (t.length === 0) return { absicht: "unterhaltung", grund: "leer" };

  for (const m of MUSTER) {
    if (m.muster.test(t)) return { absicht: m.absicht, grund: m.grund };
  }

  /*
   * Angaben zuletzt, und nur mit einer Zahl.
   *
   * „Ich verdiene 62k" enthält eine Angabe. „Ich bin unzufrieden"
   * auch — aber keine, die sich als Wert speichern liesse. Ohne die
   * Zahl liefe die Extraktion bei jedem zweiten Satz und schriebe
   * Vermutungen ins Profil.
   */
  if (ZAHLANGABE.test(t) && /\b(ich|mir|mein|wir|uns)\b/i.test(t)) {
    return { absicht: "profil_angabe", grund: "eigene Angabe mit Zahl" };
  }

  return { absicht: "unterhaltung", grund: "kein Muster getroffen" };
}
