import type { ScoreFactor } from "@paycheck/domain";

/**
 * Was für eine Aussage ein Faktor ist.
 *
 * ══════════════════════════════════════════════════════════════
 * Warum das nicht aus dem Zahlenwert folgt
 * ══════════════════════════════════════════════════════════════
 *
 * Bisher war jeder Faktor derselbe Bautyp: ein Wert zwischen 0 und 1
 * mit einem erklärenden Satz. Damit liess sich nicht sagen, welcher
 * davon ein Einwand ist.
 *
 * Ein Beispiel, an dem der Unterschied hängt:
 *
 *   raw = 0.3, "Drei Remote-Tage, du wolltest vier"   → Abstrich
 *   raw = 0.3, "Du brauchst B2 Deutsch, gefordert C1" → Blocker
 *
 * Dieselbe Zahl, dieselbe Gewichtung, völlig andere Bedeutung. Das
 * erste ist ein Kompromiss, den viele eingehen; das zweite heisst,
 * dass eine Bewerbung nicht gelesen wird. Wer nur die Zahl hat, muss
 * beides gleich behandeln — und zeigt entweder harte Ausschlüsse als
 * Nuance oder weiche Abstriche als Ausschluss.
 *
 * ══════════════════════════════════════════════════════════════
 * Was `raw: null` bedeutet und was nicht
 * ══════════════════════════════════════════════════════════════
 *
 * Ein unbekannter Wert ist kein schlechter Wert. Eine Stelle ohne
 * Gehaltsangabe ist nicht schlecht bezahlt — es steht nur nichts da.
 * Deshalb ist `fehlende_angabe` eine eigene Art und kein Konflikt:
 * Nina kann danach fragen, statt die Stelle abzuwerten.
 */
export type Faktorart =
  | "positiv"
  | "neutral"
  | "fehlende_angabe"
  | "konflikt"
  | "blocker";

export type Einstufung = {
  art: Faktorart;
  /** 1 leicht bis 3 schwer. Nur bei Konflikt und Blocker gesetzt. */
  schwere: number | null;
};

/**
 * Ab hier gilt ein Faktor als tragend statt nur als vorhanden.
 *
 * Unterhalb von 0.7 ist etwas erfüllt, aber nicht gut erfüllt — und
 * „gut" ist das Wort, das Nina benutzt, wenn sie einen Faktor als
 * positiv nennt. Wer die Schwelle senkt, macht ihre Aussagen wohlwollend
 * bis zur Bedeutungslosigkeit.
 */
const GUT = 0.7;

/** Darunter ist etwas nicht mehr knapp verfehlt, sondern verfehlt. */
const SCHLECHT = 0.4;

/**
 * Faktoren, die eine Bewerbung tatsächlich beenden.
 *
 * Die Liste ist bewusst kurz und aufzählend statt gemustert. Ein
 * Blocker ist eine harte Aussage — „bewirb dich hier nicht" — und die
 * darf nicht dadurch entstehen, dass ein neuer Faktorname zufällig auf
 * ein Muster passt. Wer einen aufnimmt, soll es merken.
 */
const HARTE_BEDINGUNG = new Set([
  "arbeitserlaubnis",
  "sprache",
  "fuehrerschein",
  "approbation",
  "sicherheitsueberpruefung",
  "standort_unmoeglich",
]);

/**
 * Einen Faktor einstufen.
 *
 * `harteBedingung` kommt von aussen, weil dieselbe Sache je nach
 * Mensch hart oder weich sein kann: „höchstens 30 Minuten Weg" ist für
 * die eine Person eine Präferenz und für die andere — Kind, feste
 * Abholzeit — nicht verhandelbar. Diese Datei kann das nicht wissen;
 * `preferences.harte_bedingung` weiss es.
 */
export function einstufen(
  faktor: Pick<ScoreFactor, "key" | "raw" | "weight">,
  harteBedingung = false,
): Einstufung {
  if (faktor.raw === null) return { art: "fehlende_angabe", schwere: null };

  const hart = harteBedingung || HARTE_BEDINGUNG.has(faktor.key);

  /*
   * Eine harte Bedingung kennt kein „fast".
   *
   * Der Schwellwert ist absichtlich hoch: Wenn jemand sagt, etwas sei
   * nicht verhandelbar, ist eine Erfüllung zu 65 % keine Erfüllung. Was
   * darunter liegt, blockt — mit einer Schwere, die sich nach dem
   * Abstand richtet, damit Nina „geht nicht" von „geht knapp nicht"
   * unterscheiden kann.
   */
  if (hart && faktor.raw < GUT) {
    return { art: "blocker", schwere: faktor.raw < SCHLECHT ? 3 : 2 };
  }

  if (faktor.raw >= GUT) return { art: "positiv", schwere: null };

  /*
   * Ein Abstrich zählt nur, wo er wehtut.
   *
   * Die Gewichtung ist die Stelle, an der steht, wie wichtig der Person
   * dieser Punkt ist. Ein schwach erfüllter Faktor mit 5 % Gewicht ist
   * eine Fussnote, kein Einwand — den als Konflikt zu melden hiesse,
   * die Liste der Einwände mit Belanglosem zu füllen, bis niemand sie
   * mehr liest.
   */
  if (faktor.raw < SCHLECHT && faktor.weight >= 0.15) {
    return { art: "konflikt", schwere: faktor.weight >= 0.3 ? 2 : 1 };
  }

  return { art: "neutral", schwere: null };
}

/**
 * Ob eine Stelle wegen harter Bedingungen ausscheidet.
 *
 * Getrennt von der Einstufung, weil die Antwort verschieden gebraucht
 * wird: Die Einstufung erklärt eine einzelne Zeile, das hier entscheidet,
 * ob die Stelle überhaupt in die Liste kommt.
 */
export function blockiert(
  einstufungen: readonly Einstufung[],
): boolean {
  return einstufungen.some((e) => e.art === "blocker" && (e.schwere ?? 0) >= 2);
}
