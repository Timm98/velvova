/**
 * Welche Sprache ein Anzeigentext hat.
 *
 * ── Warum ohne Sprachmodell ───────────────────────────────────
 *
 * Bei 2,3 Millionen Anzeigen wäre ein Modellaufruf je Anzeige nicht
 * bezahlbar und nicht nötig. Deutsch und Englisch unterscheiden sich
 * an ihren häufigsten Wörtern so deutlich, dass Zählen genügt — und
 * Zählen ist prüfbar, wiederholbar und kostet nichts.
 *
 * `language_detection` steht seit dem ersten Entwurf im Modellrouter
 * und wurde nie benutzt. Für einen einzelnen Text mit unklarem
 * Ergebnis wäre es die richtige zweite Stufe; für den Bestand ist es
 * die falsche erste.
 *
 * ── Warum nur zwei Sprachen und „unbekannt" ───────────────────
 *
 * Wir haben Anzeigen aus 19 Ländern, aber die Oberfläche gibt es auf
 * Deutsch und Englisch. Eine französische Anzeige als „nicht Deutsch"
 * zu erkennen reicht, um sie nicht fälschlich für deutsch zu halten;
 * sie als Französisch zu benennen, ohne etwas damit zu tun, wäre
 * Genauigkeit ohne Zweck.
 *
 * `unbekannt` ist ein Ergebnis, kein Fehler. Ein zu kurzer Text hat
 * keine erkennbare Sprache, und ihn zu raten hiesse, eine deutsche
 * Anzeige zu übersetzen oder eine englische stehenzulassen.
 */

export type Sprache = "de" | "en" | "unbekannt";

/*
 * Funktionswörter, die in Stellenanzeigen praktisch immer vorkommen
 * und in der anderen Sprache nicht.
 *
 * Bewusst keine Fachbegriffe: „Manager", „Team", „Service" und
 * „Software" stehen in deutschen Anzeigen genauso oft wie in
 * englischen und würden die Zählung verderben.
 */
const DEUTSCH = [
  "und", "der", "die", "das", "für", "mit", "von", "wir", "sie", "bei",
  "eine", "einen", "einer", "dich", "deine", "ihre", "unser", "sind",
  "werden", "haben", "auch", "sowie", "durch", "nicht", "über",
];

const ENGLISCH = [
  "and", "the", "for", "with", "you", "your", "our", "are", "will",
  "have", "this", "that", "from", "they", "their", "about", "into",
  "who", "what", "should", "would", "been", "were",
];

/** Ab wie vielen Wörtern eine Zählung etwas aussagt. */
export const MIN_WOERTER = 25;

/**
 * Wie deutlich der Vorsprung sein muss.
 *
 * Zweifache Häufigkeit. Darunter ist der Text gemischt — zweisprachige
 * Anzeigen gibt es, und dort ist „unbekannt" richtiger als eine
 * Entscheidung, die zur Hälfte falsch ist.
 */
export const VORSPRUNG = 2;

export interface Spracherkennung {
  sprache: Sprache;
  /** Getroffene Funktionswörter je Sprache — für die Nachprüfung. */
  deutsch: number;
  englisch: number;
  woerter: number;
}

export function spracheErkennen(text: string | null | undefined): Spracherkennung {
  const roh = (text ?? "").toLowerCase();
  const woerter = roh.split(/[^a-zäöüß]+/).filter((w) => w.length > 1);

  if (woerter.length < MIN_WOERTER) {
    return { sprache: "unbekannt", deutsch: 0, englisch: 0, woerter: woerter.length };
  }

  const menge = new Map<string, number>();
  for (const w of woerter) menge.set(w, (menge.get(w) ?? 0) + 1);
  const zaehle = (liste: readonly string[]) =>
    liste.reduce((s, w) => s + (menge.get(w) ?? 0), 0);

  const de = zaehle(DEUTSCH);
  const en = zaehle(ENGLISCH);

  /*
   * Beide bei null: ein Text ohne Funktionswörter — eine Aufzählung
   * von Techniken etwa. Keine Sprache erkennbar.
   */
  if (de === 0 && en === 0) {
    return { sprache: "unbekannt", deutsch: de, englisch: en, woerter: woerter.length };
  }

  if (de >= en * VORSPRUNG) {
    return { sprache: "de", deutsch: de, englisch: en, woerter: woerter.length };
  }
  if (en >= de * VORSPRUNG) {
    return { sprache: "en", deutsch: de, englisch: en, woerter: woerter.length };
  }
  return { sprache: "unbekannt", deutsch: de, englisch: en, woerter: woerter.length };
}

/**
 * Muss dieser Text für diese Oberfläche übersetzt werden?
 *
 * Nur wenn die Sprache SICHER eine andere ist. „unbekannt" wird nicht
 * übersetzt: Eine deutsche Anzeige durch die Übersetzung zu schicken
 * kostet Geld und macht sie schlechter.
 */
export function brauchtUebersetzung(erkannt: Sprache, oberflaeche: string): boolean {
  if (erkannt === "unbekannt") return false;
  const ziel = oberflaeche.slice(0, 2).toLowerCase();
  return erkannt !== ziel;
}
