/**
 * ══════════════════════════════════════════════════════════════════
 * Der Nachweis — und warum er fast nichts behaupten darf
 * ══════════════════════════════════════════════════════════════════
 *
 * Ein randomisiertes Feldexperiment in Südafrika hat den Unterschied
 * gemessen, um den es hier geht: Teilbare Kompetenznachweise erhöhten
 * die Beschäftigungswahrscheinlichkeit um 5,2 Prozentpunkte.
 * Ausschliesslich privates Feedback — jemandem sagen, dass er gut ist —
 * bewirkte nichts.
 *
 * Für dieses Produkt heisst das: „Monday hält dich für geeignet" ist
 * wertlos. Ein Zeugnis, das ein Mensch weitergeben kann, ist es nicht.
 *
 * ── Was ein Zeugnis wertlos macht ───────────────────────────────
 *
 * Ein Gesamturteil. „Geeignet", „88 von 100", „Talent-Score B+" —
 * das ist die Sprache von Persönlichkeitstests, und Personaler wissen,
 * was sie davon zu halten haben. Wertvoll ist nur die Beschreibung
 * eines konkreten Vorgangs: WAS wurde bearbeitet, UNTER WELCHEN
 * Bedingungen, mit WELCHEM Ergebnis, WANN, und WER steht dafür ein.
 *
 * Diese Datei setzt das durch. Sie lässt kein Zeugnis zu, das mehr
 * sagt als das.
 *
 * ── Die Regel, die niemand umgehen darf ─────────────────────────
 *
 * Ein misslungener Versuch hinterlässt keine Spur. Kein Eintrag, kein
 * Vermerk, keine Zählung.
 *
 * Der Grund ist nicht Freundlichkeit, sondern Brauchbarkeit: Ein
 * System, in dem Üben aktenkundig wird, ist ein System, in dem niemand
 * übt. Und eine gespeicherte Misserfolgsquote wäre genau die verdeckte
 * Negativliste, die ein Kompetenznachweis nie werden darf.
 */

/* ── Die Aufgabe ─────────────────────────────────────────────── */

/**
 * Woher eine Prüfaufgabe stammen darf.
 *
 * `aus_anzeige` ist der Regelfall: Die Aufgabe leitet sich aus dem ab,
 * was in der Anzeige tatsächlich verlangt wird. `vom_arbeitgeber` ist
 * der stärkere Fall — dann steht ein Unternehmen dahinter und hat
 * gesagt, was es sehen will.
 */
export const AUFGABENHERKUNFT = ["aus_anzeige", "vom_arbeitgeber"] as const;
export type Aufgabenherkunft = (typeof AUFGABENHERKUNFT)[number];

export interface Aufgabe {
  /** Was zu tun ist, in der Sprache der Zielbranche. */
  text: string;
  /**
   * Die Tätigkeit, für die diese Aufgabe steht.
   *
   * Ohne sie ist ein Zeugnis nicht einzuordnen: „hat eine Aufgabe
   * gelöst" sagt niemandem etwas.
   */
  taetigkeit: string;
  herkunft: Aufgabenherkunft;
  /**
   * Was benutzt werden darf.
   *
   * Steht ausdrücklich da, weil es sonst jeder anders annimmt — und
   * weil es zur späteren Arbeitsumgebung passen muss. Wer im Beruf
   * mit Nachschlagewerk arbeitet, soll nicht ohne geprüft werden.
   */
  hilfsmittel: string[];
  /** Wie lange vorgesehen ist. Minuten. */
  minuten: number;
}

/**
 * Wie lange eine Prüfaufgabe höchstens dauern darf.
 *
 * Neunzig Minuten. Darüber ist es keine Arbeitsprobe mehr, sondern
 * unbezahlte Arbeit — und der Unterschied ist genau der, an dem sich
 * seriöse Verfahren von Ausbeutung trennen.
 */
export const HOECHSTDAUER = 90;

export type Aufgabenbefund =
  | { art: "gueltig" }
  | {
      art: "untauglich";
      grund:
        | "keine_taetigkeit"
        | "zu_lang"
        | "keine_hilfsmittel_genannt"
        | "zu_knapp";
    };

export function aufgabePruefen(a: Aufgabe): Aufgabenbefund {
  if (!a.taetigkeit?.trim()) return { art: "untauglich", grund: "keine_taetigkeit" };
  if (a.text.trim().length < 60) return { art: "untauglich", grund: "zu_knapp" };
  if (a.minuten > HOECHSTDAUER) return { art: "untauglich", grund: "zu_lang" };
  /*
   * Eine leere Liste ist eine Angabe, `undefined` nicht. Wer nichts
   * über Hilfsmittel sagt, hat nicht „keine" gemeint — er hat nicht
   * daran gedacht, und der Geprüfte rät dann.
   */
  if (!Array.isArray(a.hilfsmittel)) {
    return { art: "untauglich", grund: "keine_hilfsmittel_genannt" };
  }
  return { art: "gueltig" };
}

/* ── Das Zeugnis ─────────────────────────────────────────────── */

/**
 * Wörter, die aus einer Beschreibung ein Urteil machen.
 *
 * Ein Zeugnis, das „geeignet" sagt, behauptet etwas über einen
 * Menschen. Eines, das „hat die Abweichung in Position 4 gefunden"
 * sagt, beschreibt einen Vorgang — und nur das lässt sich prüfen,
 * bestreiten und richtigstellen.
 */
const URTEIL =
  /\b(geeignet|ungeeignet|qualifiziert|talent\w*|potenzial\w*|begab\w*|befähigt|empfehlenswert|überdurchschnittlich|unterdurchschnittlich|note\b|punktzahl|score\b|rang\b|platz \d)\b/i;

export interface Zeugnis {
  /** Welche Tätigkeit geprüft wurde. */
  taetigkeit: string;
  /** Was konkret bearbeitet wurde. */
  aufgabe: string;
  /** Unter welchen Bedingungen — Zeit, Hilfsmittel, Umgebung. */
  bedingungen: string;
  /**
   * Was dabei herauskam, als Beobachtung.
   *
   * „Hat alle vier Abweichungen gefunden, eine davon falsch begründet"
   * — nicht „gut bestanden".
   */
  ergebnis: string;
  /** Wer dafür einsteht. */
  aussteller: string;
  ausgestelltAm: Date;
  /**
   * Bis wann die Aussage trägt.
   *
   * Ein Nachweis ohne Ende wird mit der Zeit zur Behauptung: Was
   * jemand vor sechs Jahren konnte, sagt über heute wenig.
   */
  gueltigBis: Date | null;
}

export type Zeugnisbefund =
  | { art: "gueltig" }
  | { art: "unzulaessig"; grund: "gesamturteil"; wort: string }
  | {
      art: "unvollstaendig";
      fehlt: ("taetigkeit" | "aufgabe" | "bedingungen" | "ergebnis" | "aussteller")[];
    };

/**
 * Darf dieses Zeugnis ausgestellt werden?
 *
 * Die Prüfung ist absichtlich streng an einer Stelle und grosszügig
 * an allen anderen: Was fehlt, lässt sich ergänzen. Ein Gesamturteil
 * lässt sich nicht ergänzen — es muss weg.
 */
export function zeugnisPruefen(z: Zeugnis): Zeugnisbefund {
  const fehlt: ("taetigkeit" | "aufgabe" | "bedingungen" | "ergebnis" | "aussteller")[] = [];
  if (!z.taetigkeit?.trim()) fehlt.push("taetigkeit");
  if (!z.aufgabe?.trim()) fehlt.push("aufgabe");
  if (!z.bedingungen?.trim()) fehlt.push("bedingungen");
  if (!z.ergebnis?.trim()) fehlt.push("ergebnis");
  if (!z.aussteller?.trim()) fehlt.push("aussteller");
  if (fehlt.length > 0) return { art: "unvollstaendig", fehlt };

  /*
   * Geprüft wird nur das Ergebnisfeld.
   *
   * In der Aufgabenbeschreibung darf „Note" vorkommen — etwa wenn die
   * Aufgabe darin besteht, Noten zu berechnen. Was nicht vorkommen
   * darf, ist ein Urteil über den Menschen, und das stünde im
   * Ergebnis.
   */
  const treffer = z.ergebnis.match(new RegExp(URTEIL.source, "i"));
  if (treffer) {
    return { art: "unzulaessig", grund: "gesamturteil", wort: treffer[0] };
  }

  return { art: "gueltig" };
}

/**
 * Gilt dieses Zeugnis heute noch?
 *
 * Getrennt von `zeugnisPruefen`, weil das zwei verschiedene Fragen
 * sind: ob es je ausgestellt werden durfte, und ob man sich heute
 * darauf berufen kann.
 */
export function zeugnisGilt(z: Zeugnis, jetzt: Date = new Date()): boolean {
  if (!z.gueltigBis) return true;
  return z.gueltigBis.getTime() > jetzt.getTime();
}

/* ── Was mit einem misslungenen Versuch geschieht ────────────── */

export type Versuchsausgang = "bestanden" | "nicht_bestanden" | "abgebrochen";

/**
 * Wird dieser Versuch gespeichert?
 *
 * Nur ein bestandener. Das ist keine Freundlichkeit, sondern eine
 * Konstruktionsentscheidung:
 *
 *   Ein System, in dem Üben aktenkundig wird, ist ein System, in dem
 *   niemand übt.
 *
 * Und eine gespeicherte Misserfolgsquote wäre die verdeckte
 * Negativliste, die ein Kompetenznachweis nie werden darf — sie würde
 * irgendwann in eine Auswahlentscheidung einfliessen, und niemand
 * könnte mehr sagen, wann das angefangen hat.
 *
 * Auch nicht gespeichert wird die ANZAHL der Versuche. Sie ist
 * dieselbe Information, nur schwerer zu erkennen.
 */
export function wirdFestgehalten(ausgang: Versuchsausgang): boolean {
  return ausgang === "bestanden";
}

/**
 * Was ein Mensch nach einem misslungenen Versuch erfährt.
 *
 * Eine Rückmeldung, ja — aber sie bleibt bei ihm. Das ist der
 * Unterschied zwischen Übung und Prüfung, und beide haben ihren Platz:
 * Die Übung gehört ihm, die Prüfung gehört ins Zeugnis.
 */
export interface Rueckmeldung {
  /** Was gestimmt hat. Zuerst, weil es zuerst gelesen wird. */
  richtig: string[];
  /** Wo es nicht gereicht hat, als Beobachtung statt als Urteil. */
  offen: string[];
  /** Ob ein weiterer Versuch möglich ist. */
  nochmal: boolean;
}
