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
  /**
   * Woran sich die Lösung messen lässt.
   *
   * Ohne Prüfpunkte ist die Bewertung ein Urteil, und ein Urteil ist
   * genau das, was dieses Zeugnis nicht enthalten darf. Siehe
   * `probeBewerten` weiter unten.
   */
  pruefpunkte: Pruefpunkt[];
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

/* ── Die Bewertung ───────────────────────────────────────────── */

/**
 * ══════════════════════════════════════════════════════════════════
 * Warum eine Aufgabe eine Lösung haben muss
 * ══════════════════════════════════════════════════════════════════
 *
 * Eine automatisch bewertete Arbeitsprobe ist nur so glaubwürdig wie
 * ihre Bewertung. „Schreibe einen Text über X" lässt sich nicht
 * bewerten, ohne zu urteilen — und ein Urteil ist genau das, was
 * dieses Zeugnis nicht enthalten darf.
 *
 * Deshalb hat jede Aufgabe Prüfpunkte: Dinge, die in der Lösung
 * vorkommen müssen, weil sie in der Sache liegen. „Finde die
 * Abweichungen in vier Anträgen" hat vier davon. Ob jemand sie
 * gefunden hat, ist dann kein Ermessen, sondern ein Abgleich.
 *
 * ── Warum der Mensch die Prüfpunkte danach sieht ────────────────
 *
 * Weil eine Bewertung, die man nicht nachrechnen kann, keine ist.
 * Nach der Abgabe steht offen, was erwartet wurde — dann kann jemand
 * widersprechen, und ein Widerspruch, den es geben kann, ist der
 * Grund, warum man dem Ergebnis glaubt.
 */

export interface Pruefpunkt {
  /** Was zu finden oder zu tun war. */
  was: string;
  /** Woran man erkennt, dass es getan wurde. */
  erwartet: string;
}

/**
 * Wie viele Prüfpunkte getroffen sein müssen.
 *
 * Drei Viertel. Nicht alle: Eine Arbeitsprobe, die nur bei
 * Fehlerfreiheit besteht, misst Sorgfalt unter Zeitdruck und nicht,
 * ob jemand die Arbeit kann. Nicht die Hälfte: Wer die Hälfte einer
 * Aufgabe löst, hat sie nicht gelöst.
 */
export const BESTEHENSGRENZE = 0.75;

export interface Bewertung {
  /** Welche Prüfpunkte getroffen wurden — in derselben Reihenfolge. */
  getroffen: boolean[];
  /** Was der Mensch dazu bekommt, unabhängig vom Ausgang. */
  anmerkungen: string[];
}

export type Probenausgang =
  | { art: "bestanden"; ergebnistext: string; getroffen: number; gesamt: number }
  | { art: "nicht_bestanden"; getroffen: number; gesamt: number }
  | { art: "nicht_bewertbar"; grund: "keine_pruefpunkte" | "unvollstaendig" };

/**
 * Aus Prüfpunkten und Treffern ein Ergebnis machen.
 *
 * Der Ergebnistext beschreibt, was passiert ist — er urteilt nicht.
 * „Hat 4 von 4 Punkten getroffen" ist eine Beobachtung; „hat die
 * Aufgabe gut gelöst" wäre eine Meinung, und `zeugnisPruefen` würde
 * sie zurückweisen.
 */
export function probeBewerten(
  punkte: readonly Pruefpunkt[],
  bewertung: Bewertung,
): Probenausgang {
  if (punkte.length === 0) return { art: "nicht_bewertbar", grund: "keine_pruefpunkte" };
  if (bewertung.getroffen.length !== punkte.length) {
    /*
     * Eine Bewertung, die nicht zu jedem Prüfpunkt etwas sagt, ist
     * unvollständig — und ein Ergebnis daraus wäre geraten. Lieber
     * kein Zeugnis als eines, dessen Zustandekommen niemand
     * nachvollziehen kann.
     */
    return { art: "nicht_bewertbar", grund: "unvollstaendig" };
  }

  const getroffen = bewertung.getroffen.filter(Boolean).length;
  const gesamt = punkte.length;

  if (getroffen / gesamt < BESTEHENSGRENZE) {
    return { art: "nicht_bestanden", getroffen, gesamt };
  }

  /*
   * Was nicht getroffen wurde, steht im Ergebnistext mit drin.
   *
   * Ein Zeugnis, das nur die Treffer nennt, ist ein Werbetext. Wer
   * liest „hat drei von vier gefunden, die vierte übersehen", weiss
   * mehr — und glaubt den drei anderen deshalb.
   */
  const verfehlt = punkte.filter((_, i) => !bewertung.getroffen[i]).map((p) => p.was);
  const teile = [`Hat ${getroffen} von ${gesamt} Prüfpunkten getroffen`];
  if (verfehlt.length > 0) teile.push(`nicht getroffen: ${verfehlt.join("; ")}`);
  if (bewertung.anmerkungen.length > 0) teile.push(bewertung.anmerkungen.join("; "));

  return {
    art: "bestanden",
    ergebnistext: teile.join(". ") + ".",
    getroffen,
    gesamt,
  };
}
