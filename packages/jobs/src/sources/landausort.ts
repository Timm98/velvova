/**
 * Das Land aus einer Ortsangabe lesen.
 *
 * ══════════════════════════════════════════════════════════════
 * Der Fehler, den das behebt
 * ══════════════════════════════════════════════════════════════
 *
 * In `arbeitnow.ts` stand:
 *
 *   country: /deutschland|germany|berlin|…/i.test(location) ? "DE" : "DE"
 *
 * Beide Zweige geben „DE". Ein Ternär, das nichts entscheidet —
 * jemand hat den zweiten Fall offengelassen und den Platzhalter
 * stehen lassen.
 *
 * Die Folge war nicht sichtbar, solange niemand das Land benutzte.
 * Seit die Stellensuche danach filtert und die Ortsauflösung gegen
 * eine deutsche Referenz sucht, ist sie es: Gemessen am 7. September
 * 2026 trugen 222 von 2.000 Anzeigen dieser Quelle „DE" und einen
 * Ort in London, Watford oder Toronto.
 *
 * Sie tauchten damit in einer Suche nach deutschen Stellen auf, und
 * ihre Koordinaten liessen sich nicht auflösen — die deutsche
 * Referenztabelle kennt kein Watford.
 *
 * ══════════════════════════════════════════════════════════════
 * Was diese Funktion kann und was nicht
 * ══════════════════════════════════════════════════════════════
 *
 * Sie liest, was DASTEHT. „Berlin, Germany" ergibt DE, „London,
 * United Kingdom" ergibt GB. Ein blosses „Berlin" ergibt `null` —
 * es gibt ein Berlin in Maryland, und aus einem Stadtnamen allein
 * ein Land zu schliessen ist genau die Sorte Vermutung, die diesen
 * Fehler erzeugt hat.
 *
 * `null` heisst: nicht erkennbar. Der Aufrufer entscheidet dann mit
 * dem, was er über seine Quelle weiss.
 */

/*
 * ══════════════════════════════════════════════════════════════
 * `\b` kennt keine Umlaute — zum dritten Mal in diesem Projekt
 * ══════════════════════════════════════════════════════════════
 *
 * `\b(österreich)\b` trifft „Österreich" NICHT. Die Wortgrenze ist
 * über `[A-Za-z0-9_]` definiert; vor einem „Ö" liegt für die Maschine
 * keine. Derselbe Fehler hat heute schon zwei Muster lautlos
 * ausgeschaltet.
 *
 * Deshalb wird die Grenze hier nicht mehr von Hand geschrieben,
 * sondern gebaut: eine Zeichenklasse mit Umlauten und Umschauen
 * davor und dahinter. Wer einen Ländernamen ergänzt, kann ihn nicht
 * mehr falsch einfassen.
 */
const WORTZEICHEN = "[\\wäöüÄÖÜßéèàçñ]";

function wortMuster(namen: readonly string[]): RegExp {
  return new RegExp(
    `(?<!${WORTZEICHEN})(?:${namen.join("|")})(?!${WORTZEICHEN})`,
    "i",
  );
}

/**
 * Ländernamen, wie sie in Ortsangaben vorkommen.
 *
 * ── Warum die Reihenfolge zählt ───────────────────────────────
 *
 * Die erste Übereinstimmung gewinnt. „Austria" und „Australia"
 * fangen gleich an; geprüft wird auf ganze Wörter, und die
 * spezifischeren Namen stehen vorn.
 */
const LAENDER: readonly (readonly [string, RegExp])[] = (
  [
    ["GB", ["united kingdom", "great britain", "england", "scotland", "wales", "northern ireland", "u\\.?k\\.?"]],
    ["US", ["united states", "u\\.?s\\.?a\\.?", "usa"]],
    ["AT", ["österreich", "oesterreich", "austria"]],
    ["CH", ["schweiz", "switzerland", "suisse", "svizzera"]],
    ["DE", ["deutschland", "germany", "allemagne"]],
    ["FR", ["frankreich", "france"]],
    ["NL", ["niederlande", "netherlands", "nederland", "holland"]],
    ["BE", ["belgien", "belgium", "belgique"]],
    ["ES", ["spanien", "spain", "españa", "espana"]],
    ["IT", ["italien", "italy", "italia"]],
    ["PL", ["polen", "poland", "polska"]],
    ["CZ", ["tschechien", "czech republic", "czechia"]],
    ["DK", ["dänemark", "denmark", "danmark"]],
    ["SE", ["schweden", "sweden", "sverige"]],
    ["NO", ["norwegen", "norway", "norge"]],
    ["FI", ["finnland", "finland", "suomi"]],
    ["IE", ["irland", "ireland", "éire"]],
    ["PT", ["portugal"]],
    ["CA", ["kanada", "canada"]],
    ["AU", ["australien", "australia"]],
    ["NZ", ["neuseeland", "new zealand"]],
    ["BR", ["brasilien", "brazil", "brasil"]],
    ["IN", ["indien", "india"]],
    ["SG", ["singapur", "singapore"]],
    ["LU", ["luxemburg", "luxembourg"]],
  ] as const
).map(([code, namen]) => [code, wortMuster(namen)] as const);

/**
 * Der Ländercode aus einer Ortsangabe — oder `null`.
 *
 * ── Warum auch das Kürzel am Ende zählt ───────────────────────
 *
 * Viele Quellen schreiben „London, UK" oder „Toronto, ON, CA". Das
 * letzte Feld ist dann der Ländercode, und ihn zu übersehen hiesse,
 * genau die Angaben zu verwerfen, die am eindeutigsten sind.
 */
export function landAusOrt(ort: string | null | undefined): string | null {
  const text = (ort ?? "").trim();
  if (text.length < 2) return null;

  /*
   * Bei mehreren Ländern gewinnt das erste im TEXT.
   *
   * „Deutschland, Österreich, Schweiz und Italien" ist eine Anzeige
   * für den deutschsprachigen Raum. Die erste Nennung ist der
   * Schwerpunkt; die Reihenfolge unserer Liste wäre dagegen willkürlich
   * — sie ergab hier „AT", weil Österreich in der Liste weiter oben
   * steht.
   */
  let bestesLand: string | null = null;
  let bestePosition = Number.POSITIVE_INFINITY;
  for (const [code, muster] of LAENDER) {
    const treffer = muster.exec(text);
    if (treffer && treffer.index < bestePosition) {
      bestePosition = treffer.index;
      bestesLand = code;
    }
  }
  if (bestesLand) return bestesLand;

  /*
   * Ein Kürzel als letztes Feld: „Toronto, ON, CA".
   *
   * Nur am Ende und nur zwei Grossbuchstaben — sonst würde „Berlin,
   * DE" richtig und „Aachen, NRW" falsch gelesen. Deshalb zusätzlich
   * gegen die Liste bekannter Codes geprüft.
   */
  const felder = text.split(",").map((f) => f.trim());
  const letztes = felder.at(-1) ?? "";
  if (/^[A-Z]{2}$/.test(letztes)) {
    const bekannt = new Set(LAENDER.map(([c]) => c));
    if (bekannt.has(letztes)) return letztes;
  }

  return null;
}
